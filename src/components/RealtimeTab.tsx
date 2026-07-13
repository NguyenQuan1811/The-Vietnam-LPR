'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import SnapshotModal from './SnapshotModal';
import { API_BASE } from '@/lib/api';

interface Region {
  id: number;
  name: string;
  location: string | null;
}

interface PlateResult {
  bbox: number[];
  text: string;
  conf: number;
}

interface HistoryRecord {
  id: string;
  plateText: string;
  startTime: Date;
  endTime: Date;
  maxConf: number;
  snapshot: string;
}

interface ActivePlate {
  recordId: string;
  lastSeen: number;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('vi-VN', { hour12: false });
}

function isSimilarPlate(p1: string, p2: string): boolean {
  const clean1 = p1.replace(/[-.]/g, '').toUpperCase();
  const clean2 = p2.replace(/[-.]/g, '').toUpperCase();

  if (clean1 === clean2) return true;
  if (Math.abs(clean1.length - clean2.length) > 1) return false;

  let diffCount = 0;
  const maxLen = Math.max(clean1.length, clean2.length);
  for (let i = 0; i < maxLen; i++) {
    if (clean1[i] !== clean2[i]) {
      diffCount++;
    }
  }
  return diffCount <= 1;
}

export default function RealtimeTab() {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [placeholderContent, setPlaceholderContent] = useState<'idle' | 'connecting'>('idle');
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [modalRecord, setModalRecord] = useState<HistoryRecord | null>(null);

  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const selectedRegionIdRef = useRef('');

  useEffect(() => {
    selectedRegionIdRef.current = selectedRegionId;
  }, [selectedRegionId]);

  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const realtimeCanvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const isStreamingRef = useRef(false);
  const activePlatesRef = useRef<Record<string, ActivePlate>>({});
  const historyRecordsRef = useRef<HistoryRecord[]>([]);
  const currentDetectionsRef = useRef<PlateResult[]>([]);
  const smoothedDetectionsRef = useRef<Record<string, PlateResult>>({});
  const sentFrameSizeRef = useRef({ width: 640, height: 480 });
  const drawLoopActiveRef = useRef(false);
  const sendSingleFrameRef = useRef<() => void>(() => {});

  // Lắng nghe kết quả nhận dạng từ WebSocket
  // results = finalized plates (đã lưu DB, hiển thị history)
  // activePlates = các biển đang track (hiển thị live bbox)
  const handleResults = useCallback((results: PlateResult[], activePlates?: PlateResult[]) => {
    // Dùng activePlates cho live bbox (nếu có), nếu không thì dùng results
    const displayPlates = activePlates && activePlates.length > 0 ? activePlates : results;
    currentDetectionsRef.current = displayPlates;
    processRealtimeDetections(results);
    // Gửi frame tiếp theo ngay lập tức để đạt FPS tối đa cho bounding box
    if (isStreamingRef.current) {
      setTimeout(sendSingleFrameRef.current, 0);
    }
  }, []);

  const handleFirstResult = useCallback(() => {
    setShowPlaceholder(false);
  }, []);

  // Khi WebSocket kết nối thành công, bắt đầu gửi frame
  const handleConnected = useCallback(() => {
    console.log('WebSocket connected, bắt đầu gửi frame');
    sendSingleFrameRef.current();
  }, []);

  const { connect, disconnect, sendFrame } = useWebSocket({
    onResults: handleResults,
    onFirstResult: handleFirstResult,
    onConnected: handleConnected,
  });

  // Load cameras khi component mount — tự động xin quyền nếu chưa có
  // Cleanup camera khi component unmount (ví dụ khi đăng xuất)
  useEffect(() => {
    loadCameras();
    loadRegions();
    
    return () => {
      // Dọn dẹp tiến trình camera khi unmount
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
      }
      isStreamingRef.current = false;
      drawLoopActiveRef.current = false;
    };
  }, []);

  async function loadRegions() {
    try {
      const res = await fetch(`${API_BASE}/regions`);
      if (res.ok) {
        const data = await res.json();
        setRegions(data);
        if (data.length > 0) {
          setSelectedRegionId(String(data[0].id));
        }
      }
    } catch (err) {
      console.error('Không thể tải danh sách phân vùng camera:', err);
    }
  }

  async function loadCameras() {
    try {
      // Bước1: Thử enumerate không xin quyền
      let devices = await navigator.mediaDevices.enumerateDevices();
      let videoDevices = devices.filter((d) => d.kind === 'videoinput');

      // Bước2: Nếu chưa có quyền (label rỗng), xin quyền camera
      const needsPermission = videoDevices.length === 0 || videoDevices.every(d => !d.label);
      if (needsPermission) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          // Thành công → tắt ngay, enumerate lại để lấy label
          tempStream.getTracks().forEach(t => t.stop());
          devices = await navigator.mediaDevices.enumerateDevices();
          videoDevices = devices.filter((d) => d.kind === 'videoinput');
        } catch (permErr) {
          console.warn('User từ chối quyền camera:', permErr);
        }
      }

      setCameras(videoDevices);
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.warn('Không thể liệt kê thiết bị camera:', err);
    }
  }

  // Vẽ frame mượt trên canvas 30fps
  const startLocalDrawingLoop = useCallback(() => {
    const canvas = realtimeCanvasRef.current;
    const video = webcamVideoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawLoopActiveRef.current = true;

    function drawFrame() {
      if (!isStreamingRef.current || !drawLoopActiveRef.current) return;

      if (video!.readyState === video!.HAVE_ENOUGH_DATA) {
        if (canvas!.width !== video!.videoWidth) {
          canvas!.width = video!.videoWidth;
          canvas!.height = video!.videoHeight;
        }

        ctx!.drawImage(video!, 0, 0, canvas!.width, canvas!.height);
        drawDetectionsOnCanvas(ctx!, canvas!);
      }

      requestAnimationFrame(drawFrame);
    }

    requestAnimationFrame(drawFrame);
  }, []);

  function drawDetectionsOnCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const detections = currentDetectionsRef.current;
    
    // Nội suy mượt tọa độ bounding box cho các biển số đang active
    const activeTexts = new Set<string>();
    
    if (detections && detections.length > 0) {
      detections.forEach((plate) => {
        const text = plate.text;
        activeTexts.add(text);
        
        if (!smoothedDetectionsRef.current[text]) {
          // Khởi tạo tọa độ nếu chưa tồn tại
          smoothedDetectionsRef.current[text] = {
            bbox: [...plate.bbox],
            text: text,
            conf: plate.conf,
          };
        } else {
          // Nội suy tuyến tính (Lerp) về phía tọa độ mới
          const smoothed = smoothedDetectionsRef.current[text];
          const lerpFactor = 1.0; // Đặt thành 1.0 để bám ngay lập tức, loại bỏ độ trễ (lag)
          for (let j = 0; j < 4; j++) {
            smoothed.bbox[j] = smoothed.bbox[j] + (plate.bbox[j] - smoothed.bbox[j]) * lerpFactor;
          }
          smoothed.conf = smoothed.conf + (plate.conf - smoothed.conf) * lerpFactor;
        }
      });
    }

    // Dọn dẹp những biển đã biến mất khỏi danh sách active
    Object.keys(smoothedDetectionsRef.current).forEach((text) => {
      if (!activeTexts.has(text)) {
        delete smoothedDetectionsRef.current[text];
      }
    });

    const smoothedPlates = Object.values(smoothedDetectionsRef.current);
    if (smoothedPlates.length === 0) return;

    const colors = ['#00FF00', '#FF8C00', '#00FFFF', '#FF00FF', '#FFFF00'];

    smoothedPlates.forEach((plate, i) => {
      const bbox = plate.bbox;
      if (!bbox || bbox.length !== 4) return;

      const scaleX = canvas.width / sentFrameSizeRef.current.width;
      const scaleY = canvas.height / sentFrameSizeRef.current.height;

      const x1 = bbox[0] * scaleX;
      const y1 = bbox[1] * scaleY;
      const x2 = bbox[2] * scaleX;
      const y2 = bbox[3] * scaleY;

      const color = colors[i % colors.length];

      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      const label = `${plate.text} (${(plate.conf * 100).toFixed(2)}%)`;
      ctx.font = 'bold 16px Outfit, Inter, Arial';
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = color;
      ctx.fillRect(x1 - 2, y1 - 26, textWidth + 10, 26);

      ctx.fillStyle = '#000000';
      ctx.fillText(label, x1 + 3, y1 - 7);
    });
  }

  // Gửi một frame đơn lẻ sang server
  const sendSingleFrame = useCallback(() => {
    if (!isStreamingRef.current) return;

    const video = webcamVideoRef.current;
    const canvas = hiddenCanvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      setTimeout(sendSingleFrame, 30);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const maxW = 640;
    const scale = Math.min(1, maxW / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;

    sentFrameSizeRef.current = { width: canvas.width, height: canvas.height };

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Data = canvas.toDataURL('image/jpeg', 0.6);

    const rId = selectedRegionIdRef.current ? parseInt(selectedRegionIdRef.current, 10) : null;
    sendFrame(base64Data, 0.5, 0.5, 0.3, rId);
  }, [sendFrame]);

  // Sync ref để handleResults/handleConnected có thể gọi qua ref
  sendSingleFrameRef.current = sendSingleFrame;

  // Tạo ảnh chụp snapshot có vẽ khung nhận diện chính xác với hình lồng ảnh (PiP)
  const getAnnotatedSnapshot = useCallback((results: PlateResult[]) => {
    const canvas = hiddenCanvasRef.current;
    if (!canvas) return '';
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/jpeg', 0.8);

    // 1. Crop ảnh biển số sạch (trước khi vẽ đè bounding box) từ kết quả đầu tiên
    let tempCanvas: HTMLCanvasElement | null = null;
    const firstPlate = results[0];
    if (firstPlate && firstPlate.bbox && firstPlate.bbox.length === 4) {
      const bbox = firstPlate.bbox;
      const x1 = Math.max(0, Math.round(bbox[0]));
      const y1 = Math.max(0, Math.round(bbox[1]));
      const x2 = Math.min(canvas.width, Math.round(bbox[2]));
      const y2 = Math.min(canvas.height, Math.round(bbox[3]));
      const cropW = x2 - x1;
      const cropH = y2 - y1;

      if (cropW > 0 && cropH > 0) {
        tempCanvas = document.createElement('canvas');
        tempCanvas.width = cropW;
        tempCanvas.height = cropH;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(canvas, x1, y1, cropW, cropH, 0, 0, cropW, cropH);
        }
      }
    }

    // Lưu lại trạng thái canvas trước khi vẽ đè
    ctx.save();

    const colors = ['#00FF00', '#FF8C00', '#00FFFF', '#FF00FF', '#FFFF00'];
    results.forEach((plate, i) => {
      const bbox = plate.bbox;
      if (!bbox || bbox.length !== 4) return;

      // Do hiddenCanvas chính là frame đã scale gửi đi, tọa độ bbox khớp 1:1
      const x1 = bbox[0];
      const y1 = bbox[1];
      const x2 = bbox[2];
      const y2 = bbox[3];

      const color = colors[i % colors.length];

      // Vẽ bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      // Vẽ nhãn văn bản biển số
      const label = `${plate.text} (${(plate.conf * 100).toFixed(2)}%)`;
      ctx.font = 'bold 12px Outfit, Inter, Arial';
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = color;
      ctx.fillRect(x1 - 2, y1 - 18, textWidth + 6, 18);

      ctx.fillStyle = '#000000';
      ctx.fillText(label, x1 + 1, y1 - 5);
    });

    // 2. Vẽ ảnh nhỏ (inset crop) vào góc dưới bên phải nếu có
    if (tempCanvas && tempCanvas.width > 0 && tempCanvas.height > 0) {
      const w = canvas.width;
      const h = canvas.height;

      // Chiều rộng inset bằng 30% chiều rộng canvas (giới hạn từ 150px đến 250px)
      const insetW = Math.max(150, Math.min(250, Math.round(w * 0.3)));
      const insetH = Math.round(insetW * (tempCanvas.height / tempCanvas.width));

      // Vị trí paste (cách góc dưới phải 15px)
      const border = 3;
      const pasteX = w - insetW - border * 2 - 15;
      const pasteY = h - insetH - border * 2 - 15;

      // Vẽ viền màu xanh lá cho ảnh nhỏ
      ctx.fillStyle = '#00FF00';
      ctx.fillRect(pasteX, pasteY, insetW + border * 2, insetH + border * 2);

      // Vẽ ảnh crop đã resize vào trong viền
      ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, pasteX + border, pasteY + border, insetW, insetH);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    ctx.restore();
    return dataUrl;
  }, []);

  // Xử lý logic theo dõi biển số (stable vì chỉ đọc refs)
  const processRealtimeDetections = useCallback((results: PlateResult[]) => {
    const now = Date.now();
    const activePlates = activePlatesRef.current;

    if (results && results.length > 0) {
      results.forEach((plate) => {
        const text = plate.text;
        const conf = plate.conf;
        if (!text || text.includes('?')) return;

        const cleanText = text.replace(/[-.\s]/g, '');
        if (cleanText.length < 8) return;

        let foundActiveText: string | null = null;
        for (const activeText in activePlates) {
          if (isSimilarPlate(text, activeText)) {
            foundActiveText = activeText;
            break;
          }
        }

        if (!foundActiveText) {
          const recordId = 'rec-' + now + '-' + Math.floor(Math.random() * 1000);
          const record: HistoryRecord = {
            id: recordId,
            plateText: text,
            startTime: new Date(),
            endTime: new Date(),
            maxConf: conf,
            snapshot: getAnnotatedSnapshot(results),
          };

          historyRecordsRef.current = [record, ...historyRecordsRef.current].slice(0, 50);
          setHistoryRecords([...historyRecordsRef.current]);

          activePlates[text] = { recordId, lastSeen: now };
        } else {
          const activeInfo = activePlates[foundActiveText];
          activeInfo.lastSeen = now;

          // Cập nhật confidence mới nhất cho record trong lịch sử
          const existingRecord = historyRecordsRef.current.find(r => r.id === activeInfo.recordId);
          if (existingRecord) {
            existingRecord.maxConf = conf;
            existingRecord.endTime = new Date();
            existingRecord.snapshot = getAnnotatedSnapshot(results);
            setHistoryRecords([...historyRecordsRef.current]);
          }
        }
      });
    }

    // Quét dọn biển số đã biến mất
    for (const text in activePlates) {
      if (now - activePlates[text].lastSeen > 2500) {
        delete activePlates[text];
      }
    }
  }, []);

  // Bắt đầu camera
  async function startCamera() {
    // Nếu chưa có camera nào, thử load lại
    if (cameras.length === 0) {
      await loadCameras();
      if (cameras.length === 0) {
        alert('Không tìm thấy camera nào.\n\nKiểm tra:\n1. Camera đã kết nối chưa?\n2. Đã cho phép quyền camera ở thanh địa chỉ?\n3. Không có app nào khác đang dùng camera?');
        return;
      }
    }

    const constraints = {
      video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;

      // Sau khi được cấp quyền, cập nhật lại danh sách camera (để lấy nhãn đầy đủ)
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        if (videoDevices.length > 0) {
          setCameras(videoDevices);
        }
      } catch {
        // Không cần xử lý — danh sách camera cũ vẫn dùng được
      }

      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
      }

      setShowPlaceholder(true);
      setPlaceholderContent('connecting');
      setIsStreaming(true);
      isStreamingRef.current = true;

      // Connect WebSocket - hook sẽ gọi onConnected khi mở thành công,
      // rồi onResults sẽ tự chain frame tiếp theo
      connect();

      startLocalDrawingLoop();
    } catch (err) {
      const error = err as Error;
      if (error.name === 'NotAllowedError') {
        alert('Bạn cần cấp quyền truy cập camera.\n\nCách sửa:\n- Nhấn icon camera 🔒 trên thanh địa chỉ\n- Chọn "Cho phép"\n- Thử lại');
      } else if (error.name === 'NotFoundError') {
        alert('Không tìm thấy camera nào.\n\nKiểm tra:\n1. Camera đã kết nối chưa?\n2. Driver camera đã cài đúng?\n3. Không có app nào khác đang chiếm camera?');
      } else if (error.name === 'NotReadableError') {
        alert('Camera đang bị chiếm bởi ứng dụng khác.\n\nĐóng các app đang dùng camera (Zoom, Teams, OBS...) rồi thử lại.');
      } else {
        alert('Lỗi camera: ' + error.name + '\n' + error.message);
      }
    }
  }

  // Tắt camera
  function stopCamera() {
    isStreamingRef.current = false;
    drawLoopActiveRef.current = false;
    currentDetectionsRef.current = [];
    smoothedDetectionsRef.current = {};
    setIsStreaming(false);

    disconnect();

    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
    }

    setShowPlaceholder(true);
    setPlaceholderContent('idle');

    activePlatesRef.current = {};
    historyRecordsRef.current = [];
    setHistoryRecords([]);
  }

  const openModal = useCallback((recordId: string) => {
    const record = historyRecordsRef.current.find((r) => r.id === recordId);
    if (record) {
      setModalRecord(record);
    }
  }, []);

  const getModalTimeRange = useCallback(() => {
    if (!modalRecord) return '';
    const startStr = formatTime(modalRecord.startTime);
    const endStr = formatTime(modalRecord.endTime);
    if (startStr !== endStr) {
      const durationSec = Math.round((modalRecord.endTime.getTime() - modalRecord.startTime.getTime()) / 1000);
      return `${startStr} - ${endStr} (${durationSec} giây)`;
    }
    return `${startStr} (Đang xuất hiện)`;
  }, [modalRecord]);

  return (
    <>
      <section className="tab-content active">
        <div className="grid-layout">
          {/* Left: Configuration & Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Card: Cấu hình & Điều khiển Camera */}
            <div className="card">
              <div className="card-header">
                <h2>Cấu hình Camera</h2>
                <p>Chọn nguồn camera và vị trí lắp đặt</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', padding: '0 1.5rem 1.5rem 1.5rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="camera-select" className="form-label" style={{ fontSize: '0.85rem' }}>
                    <i className="fa-solid fa-camera" style={{ color: 'var(--primary)', marginRight: '0.5rem' }}></i>
                    Thiết bị Camera hoạt động:
                  </label>
                  <select
                    id="camera-select"
                    className="form-select"
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    disabled={isStreaming}
                  >
                    {cameras.length === 0 ? (
                      <option value="">Không tìm thấy camera nào</option>
                    ) : (
                      cameras.map((device, index) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${index + 1}`}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="region-select" className="form-label" style={{ fontSize: '0.85rem' }}>
                    <i className="fa-solid fa-map-location-dot" style={{ color: 'var(--primary)', marginRight: '0.5rem' }}></i>
                    Vị trí lắp đặt Camera (Phân vùng):
                  </label>
                  <select
                    id="region-select"
                    className="form-select"
                    value={selectedRegionId}
                    onChange={(e) => setSelectedRegionId(e.target.value)}
                    disabled={isStreaming}
                  >
                    {regions.length === 0 ? (
                      <option value="">Không tìm thấy phân vùng nào</option>
                    ) : (
                      regions.map((reg) => (
                        <option key={reg.id} value={reg.id}>
                          {reg.name} {reg.location ? `(${reg.location})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="camera-actions-row" style={{ marginTop: '0.5rem' }}>
                  {!isStreaming ? (
                    <button className="btn btn-primary btn-block" onClick={startCamera}>
                      <i className="fa-solid fa-play"></i> Bắt đầu Camera
                    </button>
                  ) : (
                    <button className="btn btn-danger btn-block" onClick={stopCamera}>
                      <i className="fa-solid fa-stop"></i> Dừng Camera
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Viewport */}
          <div className="card upload-card">


            {/* Hidden canvas for frame capture */}
            <canvas ref={hiddenCanvasRef} style={{ display: 'none' }}></canvas>

            <div className="realtime-viewport-container">
              {showPlaceholder && (
                <div className="viewport-placeholder">
                  {placeholderContent === 'idle' ? (
                    <>
                      <i className="fa-solid fa-camera"></i>
                      <span>Chưa mở Camera</span>
                    </>
                  ) : (
                    <>
                      <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, margin: '0 auto 1rem' }}></div>
                      <span>Đang kết nối camera...</span>
                    </>
                  )}
                </div>
              )}
              <video
                ref={webcamVideoRef}
                autoPlay
                playsInline
                style={{ display: 'none' }}
              ></video>
              <canvas
                ref={realtimeCanvasRef}
                id="realtime-canvas"
                style={{ display: showPlaceholder ? 'none' : 'block' }}
              ></canvas>
            </div>
          </div>
        </div>
      </section>

      <SnapshotModal
        isOpen={!!modalRecord}
        onClose={() => setModalRecord(null)}
        plateText={modalRecord?.plateText || ''}
        timeRange={getModalTimeRange()}
        confidence={modalRecord?.maxConf || 0}
        snapshotSrc={modalRecord?.snapshot || ''}
      />
    </>
  );
}
