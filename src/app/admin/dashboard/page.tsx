'use client';

import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/api';

interface DailyChartItem {
  date: string;
  count: number;
}

interface StatsData {
  total_users: number;
  total_detections: number;
  total_verified: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  daily_chart: DailyChartItem[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/admin/stats`);
      if (!res.ok) {
        throw new Error('Không thể tải số liệu thống kê.');
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
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="card" style={{ padding: '30px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
        <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2rem', color: '#ef4444', marginBottom: '15px' }}></i>
        <h3 style={{ marginBottom: '10px' }}>Lỗi tải dữ liệu</h3>
        <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '20px' }}>{error}</p>
        <button onClick={fetchStats}>Thử lại</button>
      </div>
    );
  }

  // Tìm count lớn nhất để làm mốc chiều cao cho biểu đồ
  const maxCount = stats.daily_chart.length > 0 
    ? Math.max(...stats.daily_chart.map(item => item.count)) 
    : 10;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 600 }}>Tổng quan hệ thống</h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>Bảng số liệu thống kê thời gian thực</p>
        </div>
        <button onClick={fetchStats} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-rotate"></i> Làm mới
        </button>
      </div>

      {/* Grid thẻ số liệu */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '15px', borderRadius: '10px', background: 'rgba(79, 70, 229, 0.2)', color: '#a5b4fc', fontSize: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <i className="fa-solid fa-users"></i>
          </div>
          <div>
            <h4 style={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 400, fontSize: '0.85rem' }}>Người dùng</h4>
            <span style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats.total_users}</span>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '15px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontSize: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <i className="fa-solid fa-car-rear"></i>
          </div>
          <div>
            <h4 style={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 400, fontSize: '0.85rem' }}>Biển số nhận diện</h4>
            <span style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats.total_detections}</span>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '15px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', fontSize: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <i className="fa-solid fa-square-check"></i>
          </div>
          <div>
            <h4 style={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 400, fontSize: '0.85rem' }}>Đã xác minh</h4>
            <span style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats.total_verified}</span>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '15px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', fontSize: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <i className="fa-solid fa-percent"></i>
          </div>
          <div>
            <h4 style={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 400, fontSize: '0.85rem' }}>Độ chính xác</h4>
            <span style={{ fontSize: '1.8rem', fontWeight: 700 }}>{stats.accuracy}%</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginTop: '10px' }}>
        {/* Biểu đồ số lượng nhận diện */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', fontWeight: 600 }}>Tần suất nhận diện (7 ngày qua)</h3>
          {stats.daily_chart.length === 0 ? (
            <div style={{ height: '220px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'rgba(255,255,255,0.4)' }}>
              Không có dữ liệu thống kê
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '220px', padding: '0 10px', position: 'relative' }}>
              {stats.daily_chart.map((item, idx) => {
                const heightPercentage = maxCount > 0 ? (item.count / maxCount) * 80 + 10 : 10;
                // Định dạng ngày MM-dd từ YYYY-MM-DD
                const displayDate = item.date.substring(5);
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '10px', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ position: 'relative', width: '35px', background: 'var(--accent-gradient)', height: `${heightPercentage}%`, borderRadius: '6px 6px 0 0', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', transition: 'height 0.5s ease-out' }} className="bar-hover">
                      <span style={{ position: 'absolute', top: '-25px', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>
                        {item.count}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>{displayDate}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tỷ lệ xác minh */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', fontWeight: 600 }}>Chi tiết xác minh</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.85rem' }}>
                  <span style={{ color: '#34d399' }}><i className="fa-solid fa-circle" style={{ fontSize: '0.6rem', marginRight: '6px' }}></i>Đúng</span>
                  <span>{stats.correct}</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#10b981', width: `${stats.total_verified > 0 ? (stats.correct / stats.total_verified) * 100 : 0}%` }}></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.85rem' }}>
                  <span style={{ color: '#fca5a5' }}><i className="fa-solid fa-circle" style={{ fontSize: '0.6rem', marginRight: '6px' }}></i>Sai</span>
                  <span>{stats.incorrect}</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#ef4444', width: `${stats.total_verified > 0 ? (stats.incorrect / stats.total_verified) * 100 : 0}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px', padding: '15px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '5px' }}>Tỷ lệ đánh giá chính xác của AI</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{stats.accuracy}%</span>
          </div>
        </div>
      </div>
    </>
  );
}
