'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LoginModal from '@/components/LoginModal';

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="app-container">
      <LoginModal
        isOpen={true}
        onClose={() => {}}
        onLoginSuccess={(user) => {
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('currentUser', user.username);
          localStorage.setItem('userRole', user.role);
          localStorage.setItem('userId', String(user.id));
          if (user.role === 'admin') {
            router.push('/admin');
          } else {
            router.push('/home');
          }
        }}
        initialMode="login"
        embedded={true}
      />
    </div>
  );
}
