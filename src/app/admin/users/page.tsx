'use client';

import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/api';

interface UserData {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: string;
  is_verified: number;
  is_active: boolean;
  failed_attempts: number;
  created_at: string | null;
}

export default function UsersManagement() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggleLoading, setToggleLoading] = useState<{ [key: number]: boolean }>({});

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/admin/users`);
      if (!res.ok) {
        throw new Error('Không thể tải danh sách tài khoản.');
      }
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối API.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleActive = async (userId: number, username: string) => {
    setToggleLoading(prev => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/toggle-active`, {
        method: 'POST',
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Lỗi khi thay đổi trạng thái.');
      }
      
      // Update state
      setUsers(prev => 
        prev.map(u => u.id === userId ? { ...u, is_active: data.is_active } : u)
      );
    } catch (err: any) {
      alert(err.message || 'Lỗi kết nối hoặc xử lý.');
    } finally {
      setToggleLoading(prev => ({ ...prev, [userId]: false }));
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
          <h1 style={{ fontSize: '1.8rem', fontWeight: 600 }}>Quản lý tài khoản</h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>Quản lý trạng thái hoạt động và phân quyền người dùng trong hệ thống</p>
        </div>
        <button onClick={fetchUsers} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-rotate"></i> Tải lại
        </button>
      </div>

      {error && (
        <div className="card" style={{ padding: '20px', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#fca5a5', marginBottom: '20px' }}>
          <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '8px' }}></i> {error}
        </div>
      )}

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-scroll-container">
          <table style={{ minWidth: '800px' }}>
            <thead>
              <tr>
                <th style={{ width: '80px' }}>ID</th>
                <th>Tài khoản</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Xác thực Email</th>
                <th>Đăng nhập sai</th>
                <th>Trạng thái</th>
                <th style={{ width: '150px', textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>
                    Không tìm thấy tài khoản nào
                  </td>
                </tr>
              ) : (
                users.map(user => {
                  const isChanging = toggleLoading[user.id];
                  return (
                    <tr key={user.id}>
                      <td style={{ fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>#{user.id}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{user.username}</span>
                          {user.full_name && <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>{user.full_name}</span>}
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span style={{ 
                          padding: '3px 8px', 
                          borderRadius: '4px', 
                          fontSize: '0.8rem', 
                          background: user.role === 'admin' ? 'rgba(79, 70, 229, 0.2)' : 'rgba(255,255,255,0.05)',
                          border: user.role === 'admin' ? '1px solid rgba(79, 70, 229, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                          color: user.role === 'admin' ? '#a5b4fc' : '#e2e8f0',
                          fontWeight: user.role === 'admin' ? 600 : 400
                        }}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: user.is_verified === 1 ? '#10b981' : '#f59e0b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <i className={user.is_verified === 1 ? "fa-solid fa-circle-check" : "fa-solid fa-circle-minus"}></i>
                          {user.is_verified === 1 ? 'Đã xác thực' : 'Chờ xác thực'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: user.failed_attempts > 0 ? '#ef4444' : 'rgba(255,255,255,0.4)', fontWeight: user.failed_attempts > 0 ? 600 : 400 }}>
                          {user.failed_attempts}
                        </span>
                      </td>
                      <td>
                        <span style={{ 
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          background: user.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: user.is_active ? '#34d399' : '#fca5a5',
                          fontWeight: 600
                        }}>
                          <i className="fa-solid fa-circle" style={{ fontSize: '0.5rem' }}></i>
                          {user.is_active ? 'Đang hoạt động' : 'Bị chặn'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {user.username === 'admin' ? (
                          <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Mặc định</span>
                        ) : (
                          <button 
                            onClick={() => handleToggleActive(user.id, user.username)}
                            disabled={isChanging}
                            style={{
                              backgroundColor: user.is_active ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                              border: user.is_active ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                              color: user.is_active ? '#fca5a5' : '#a7f3d0',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              width: '100px',
                              justifyContent: 'center'
                            }}
                          >
                            {isChanging ? (
                              <i className="fa-solid fa-spinner fa-spin"></i>
                            ) : user.is_active ? (
                              <><i className="fa-solid fa-ban"></i> Chặn</>
                            ) : (
                              <><i className="fa-solid fa-unlock"></i> Bỏ chặn</>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
