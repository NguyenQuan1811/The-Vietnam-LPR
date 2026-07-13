'use client';

import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/api';
import { formatVnTime } from '@/lib/utils';

interface UnverifiedDetection {
  id: number;
  plate_text: string;
  plate_confidence: number;
  alt_text: string | null;
  alt_confidence: number | null;
  total_frames: number | null;
  image_path: string;
  source_type: string;
  created_at: string;
}

export default function Verification() {
  const [items, setItems] = useState<UnverifiedDetection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editedPlates, setEditedPlates] = useState<{ [key: number]: string }>({});
  const [actionLoading, setActionLoading] = useState<{ [key: number]: boolean }>({});
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const fetchUnverified = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/admin/detections/unverified?limit=500`);
      if (!res.ok) {
        throw new Error('Không thể tải danh sách biển số chưa xác minh.');
      }
      const data = await res.json();
      setItems(data);
      
      // Initialize edit values
      const initialEdits: { [key: number]: string } = {};
      data.forEach((d: UnverifiedDetection) => {
        initialEdits[d.id] = d.plate_text;
      });
      setEditedPlates(initialEdits);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối API.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnverified();
  }, []);

  // Đảm bảo không bị kẹt ở trang rỗng nếu xác minh hết ảnh của trang cuối
  useEffect(() => {
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [items.length, currentPage]);

  const handleInputChange = (id: number, val: string) => {
    setEditedPlates(prev => ({ ...prev, [id]: val.toUpperCase() }));
  };

  const handleVerify = async (id: number, isCorrect: number) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      const correctPlate = editedPlates[id] || '';

      // Read the real user ID from localStorage
      const userId = localStorage.getItem('userId') || '0';

      // FastAPI expects these parameters in the query string
      const url = `${API_BASE}/admin/verify-detection?detection_id=${id}&correct_plate=${encodeURIComponent(correctPlate)}&is_correct=${isCorrect}&verified_by=${userId}`;

      const res = await fetch(url, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Lỗi khi xác minh.');
      }

      // Remove from lists
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (err: any) {
      alert(err.message || 'Đã xảy ra lỗi.');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa bản ghi nhận diện này?')) return;

    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`${API_BASE}/admin/detections/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Lỗi khi xóa.');
      }

      // Remove from list
      setItems(prev => prev.filter(item => item.id !== id));
      setSelectedItems(prev => prev.filter(selectedId => selectedId !== id));
    } catch (err: any) {
      alert(err.message || 'Đã xảy ra lỗi.');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedItems.length === items.length && items.length > 0) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map(item => item.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (!confirm(`Bạn có chắc muốn xóa ${selectedItems.length} bản ghi đã chọn?`)) return;

    const newLoadingState = { ...actionLoading };
    selectedItems.forEach(id => newLoadingState[id] = true);
    setActionLoading(newLoadingState);

    try {
      const res = await fetch(`${API_BASE}/admin/detections/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedItems })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Lỗi khi xóa nhiều bản ghi.');
      }

      setItems(prev => prev.filter(item => !selectedItems.includes(item.id)));
      setSelectedItems([]);
    } catch (err: any) {
      alert(err.message || 'Đã xảy ra lỗi.');
    } finally {
      const clearedLoading = { ...actionLoading };
      selectedItems.forEach(id => delete clearedLoading[id]);
      setActionLoading(clearedLoading);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 600 }}>Xác minh kết quả nhận diện</h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>Đánh giá đúng/sai kết quả nhận diện biển số của mô hình AI</p>
        </div>
        <button onClick={fetchUnverified} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-rotate"></i> Tải lại
        </button>
      </div>

      {items.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', background: 'rgba(255,255,255,0.05)', padding: '10px 15px', borderRadius: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={selectedItems.length === items.length && items.length > 0}
              onChange={handleToggleSelectAll}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <span>Chọn tất cả</span>
          </label>
          
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>|</span>
          
          <span style={{ fontSize: '0.9rem' }}>
            Đã chọn: <strong style={{ color: 'var(--primary)' }}>{selectedItems.length}</strong>
          </span>

          {selectedItems.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              style={{ marginLeft: 'auto', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <i className="fa-solid fa-trash-can"></i> Xóa ({selectedItems.length})
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="card" style={{ padding: '20px', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#fca5a5', marginBottom: '20px' }}>
          <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '8px' }}></i> {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
          <i className="fa-solid fa-circle-check" style={{ fontSize: '3rem', color: '#10b981', marginBottom: '15px' }}></i>
          <h3>Tất cả đã được xác minh!</h3>
          <p style={{ fontSize: '0.9rem', marginTop: '5px' }}>Không còn bản ghi nhận diện nào cần duyệt lúc này.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {items.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(item => {
            const formattedTime = formatVnTime(item.created_at);
            const isSaving = actionLoading[item.id];
            
            return (
              <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px', position: 'relative' }}>
                
                <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}>
                  <input 
                    type="checkbox" 
                    checked={selectedItems.includes(item.id)}
                    onChange={() => handleToggleSelect(item.id)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                </div>

                {/* Ảnh snapshot */}
                <div style={{ position: 'relative', width: '100%', height: '180px', borderRadius: '8px', overflow: 'hidden', background: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {item.image_path ? (
                    <img 
                      src={item.image_path} 
                      alt="License Plate Crop" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>Không có ảnh</span>
                  )}
                  <span style={{ position: 'absolute', top: '10px', left: '10px', padding: '4px 8px', borderRadius: '4px', background: 'rgba(0,0,0,0.6)', fontSize: '0.75rem', textTransform: 'capitalize' }}>
                    {item.source_type}
                  </span>
                </div>

                {/* Chi tiết AI */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Thời gian:</span>
                    <span>{formattedTime}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>AI dự đoán:</span>
                    <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, letterSpacing: '1px' }}>
                      {item.plate_text}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Độ tin cậy:</span>
                    <span style={{ color: item.plate_confidence >= 0.8 ? '#34d399' : '#fbbf24', fontWeight: 600 }}>
                      {(item.plate_confidence * 100).toFixed(2)}%
                    </span>
                  </div>
                  {item.alt_text && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Biển phụ:</span>
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>
                        {item.alt_text} ({((item.alt_confidence || 0) * 100).toFixed(2)}%)
                      </span>
                    </div>
                  )}
                </div>

                {/* Input chỉnh sửa & Nút xác minh */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '5px' }}>Biển số thực tế:</label>
                    <input 
                      type="text" 
                      value={editedPlates[item.id] || ''} 
                      onChange={(e) => handleInputChange(item.id, e.target.value)}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 10px', borderRadius: '6px', fontSize: '0.95rem', fontWeight: 600, letterSpacing: '1px', textAlign: 'center' }}
                      placeholder="Nhập biển số đúng..."
                      disabled={isSaving}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '5px' }}>
                    <button
                      onClick={() => handleVerify(item.id, 1)}
                      disabled={isSaving || editedPlates[item.id] !== item.plate_text}
                      style={{
                        backgroundColor: '#10b981',
                        color: '#fff',
                        opacity: (isSaving || editedPlates[item.id] !== item.plate_text) ? 0.5 : 1,
                        cursor: (isSaving || editedPlates[item.id] !== item.plate_text) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isSaving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <><i className="fa-solid fa-check" style={{ marginRight: '5px' }}></i>Đúng</>}
                    </button>
                    <button
                      onClick={() => handleVerify(item.id, 0)}
                      disabled={isSaving || !editedPlates[item.id]}
                      style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.2)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        color: '#fbc02d',
                        opacity: (isSaving || !editedPlates[item.id]) ? 0.5 : 1,
                        cursor: (isSaving || !editedPlates[item.id]) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isSaving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <><i className="fa-solid fa-xmark" style={{ marginRight: '5px' }}></i>Sai</>}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={isSaving}
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#f87171',
                        opacity: isSaving ? 0.5 : 1,
                        cursor: isSaving ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isSaving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <><i className="fa-solid fa-trash" style={{ marginRight: '5px' }}></i>Xóa</>}
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && items.length > ITEMS_PER_PAGE && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '30px', marginBottom: '20px' }}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            style={{
              padding: '8px 16px',
              backgroundColor: currentPage === 1 ? 'rgba(255,255,255,0.05)' : 'var(--primary)',
              color: currentPage === 1 ? 'rgba(255,255,255,0.4)' : '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontWeight: 600
            }}
          >
            <i className="fa-solid fa-chevron-left" style={{ marginRight: '8px' }}></i>
            Trang {currentPage > 1 ? currentPage - 1 : ''}
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
            Trang {currentPage} / {Math.ceil(items.length / ITEMS_PER_PAGE)}
          </div>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(items.length / ITEMS_PER_PAGE)))}
            disabled={currentPage === Math.ceil(items.length / ITEMS_PER_PAGE)}
            style={{
              padding: '8px 16px',
              backgroundColor: currentPage === Math.ceil(items.length / ITEMS_PER_PAGE) ? 'rgba(255,255,255,0.05)' : 'var(--primary)',
              color: currentPage === Math.ceil(items.length / ITEMS_PER_PAGE) ? 'rgba(255,255,255,0.4)' : '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: currentPage === Math.ceil(items.length / ITEMS_PER_PAGE) ? 'not-allowed' : 'pointer',
              fontWeight: 600
            }}
          >
            Trang {currentPage < Math.ceil(items.length / ITEMS_PER_PAGE) ? currentPage + 1 : ''}
            <i className="fa-solid fa-chevron-right" style={{ marginLeft: '8px' }}></i>
          </button>
        </div>
      )}
    </>
  );
}
