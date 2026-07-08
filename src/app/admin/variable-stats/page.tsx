'use client';

import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/api';

interface RegionStat {
  region: string;
  count: number;
}

export default function VariableStats() {
  const [stats, setStats] = useState<RegionStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRegionStats = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/admin/regions-stats`);
      if (!res.ok) {
        throw new Error('Không thể tải số liệu thống kê khu vực.');
      }
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối API.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRegionStats();
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const maxCount = stats.length > 0 ? Math.max(...stats.map(s => s.count)) : 1;
  const totalCount = stats.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 600 }}>Thống kê theo phân vùng / Camera</h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>Phân tích số lượt nhận diện phương tiện theo từng khu vực lắp đặt camera</p>
        </div>
        <button onClick={fetchRegionStats} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-rotate"></i> Tải lại
        </button>
      </div>

      {error && (
        <div className="card" style={{ padding: '20px', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#fca5a5', marginBottom: '20px' }}>
          <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '8px' }}></i> {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Bảng chi tiết */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Danh sách phân vùng</h3>
          </div>
          <table style={{ border: 'none' }}>
            <thead>
              <tr>
                <th>Tên phân vùng</th>
                <th style={{ textAlign: 'right' }}>Số lượt nhận diện</th>
                <th style={{ textAlign: 'right' }}>Tỷ lệ phần trăm</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>
                    Chưa có dữ liệu phân vùng
                  </td>
                </tr>
              ) : (
                stats.map((item, idx) => {
                  const percentage = totalCount > 0 ? (item.count / totalCount) * 100 : 0;
                  return (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}><i className="fa-solid fa-camera-retro" style={{ color: 'var(--primary)', marginRight: '8px' }}></i> {item.region || 'Không xác định'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{item.count}</td>
                      <td style={{ textAlign: 'right', color: 'rgba(255,255,255,0.6)' }}>{percentage.toFixed(1)}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Trực quan hóa dạng thanh ngang */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '5px' }}>Biểu đồ mật độ</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Tổng số lượt ghi nhận: <strong>{totalCount}</strong> phương tiện</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '10px' }}>
            {stats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)' }}>Không có dữ liệu</div>
            ) : (
              stats.map((item, idx) => {
                const widthPercentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 500 }}>{item.region || 'Không xác định'}</span>
                      <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{item.count} lượt</span>
                    </div>
                    <div style={{ height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          height: '100%', 
                          background: 'linear-gradient(90deg, var(--primary), #a5b4fc)', 
                          width: `${widthPercentage}%`,
                          borderRadius: '5px',
                          transition: 'width 0.8s ease-out'
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
