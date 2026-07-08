'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ImageTab from '@/components/ImageTab';
import VideoTab from '@/components/VideoTab';
import RealtimeTab from '@/components/RealtimeTab';
import LoginModal from '@/components/LoginModal';
import GeneralHistoryModal from '@/components/GeneralHistoryModal';

import { API_BASE } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('realtime-tab');

  // Kiểm tra trạng thái đăng nhập từ localStorage khi component mount
  useEffect(() => {
    const savedLogin = localStorage.getItem('isLoggedIn');
    const savedUser = localStorage.getItem('currentUser');
    const savedRole = localStorage.getItem('userRole');
    if (savedLogin === 'true') {
      setIsLoggedIn(true);
      setCurrentUser(savedUser);
      setUserRole(savedRole);
      setActiveTab('image-tab'); // Nếu đã đăng nhập, mặc định vào tab nhận diện ảnh
    } else {
      setActiveTab('realtime-tab'); // Nếu chưa đăng nhập, mặc định vào tab camera realtime
    }
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleLoginSuccess = useCallback((user: { id: number; username: string; role: string }) => {
    setIsLoggedIn(true);
    setCurrentUser(user.username);
    setUserRole(user.role);
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('currentUser', user.username);
    localStorage.setItem('userRole', user.role);
    localStorage.setItem('userId', String(user.id));
    if (user.role === 'admin') {
      router.push('/admin');
    } else {
      setActiveTab('image-tab'); // Tự động chuyển qua tab nhận diện ảnh sau khi đăng nhập thành công
    }
  }, [router]);



  const handleLogout = useCallback(async () => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: savedUser }),
        });
      } catch (err) {
        console.error('Lỗi khi gọi API đăng xuất:', err);
      }
    }
    setIsLoggedIn(false);
    setCurrentUser(null);
    setUserRole(null);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    setActiveTab('realtime-tab');
  }, []);

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isLoggedIn={isLoggedIn}
        onLoginClick={() => setIsLoginModalOpen(true)}
        onLogoutClick={handleLogout}
        currentUser={currentUser}
        userRole={userRole}
        onHistoryClick={() => setIsHistoryModalOpen(true)}
      />

      <main className="main-content">
        {isLoggedIn && activeTab === 'image-tab' && <ImageTab />}
        {isLoggedIn && activeTab === 'video-tab' && <VideoTab />}
        {activeTab === 'realtime-tab' && <RealtimeTab />}
      </main>

      <footer className="app-footer">
        <p>Hệ thống Nhận diện Biển số xe Việt Nam (LPR) &copy; 2026. Công nghệ YOLOv8 Object Detection &amp; Classification.</p>
      </footer>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <GeneralHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />
    </div>
  );
}
