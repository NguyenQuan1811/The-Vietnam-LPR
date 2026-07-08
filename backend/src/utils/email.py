import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from src.config.settings import settings

def send_otp_email(to_email: str, otp: str):
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"SMTP not configured. OTP for {to_email} is {otp}")
        return False
    
    msg = MIMEMultipart()
    msg['From'] = settings.SMTP_USER
    msg['To'] = to_email
    msg['Subject'] = "Ma OTP xac thuc Vietnam LPR"
    
    body = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #4f46e5; border-bottom: 2px solid #eef2f6; padding-bottom: 10px;">Xác nhận thao tác trên Vietnam LPR</h2>
        <p>Chào bạn,</p>
        <p>Hệ thống ghi nhận yêu cầu đăng ký hoặc khôi phục tài khoản của bạn.</p>
        <p>Mã OTP xác thực của bạn là:</p>
        <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #4f46e5; letter-spacing: 5px; background-color: #f0fdf4; padding: 10px 25px; border-radius: 6px; border: 1px dashed #86efac;">{otp}</span>
        </div>
        <p>Mã OTP này có hiệu lực trong vòng <b>5 phút</b>. Vui lòng không chia sẻ mã này cho bất kỳ ai khác.</p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;"/>
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">Trân trọng,<br/>Đội ngũ phát triển Vietnam LPR</p>
    </div>
    """
    msg.attach(MIMEText(body, 'html', 'utf-8'))
    
    try:
        server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT)
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_USER, to_email, msg.as_string())
        server.quit()
        print(f"Da gui email OTP thanh cong den {to_email}")
        return True
    except Exception as e:
        print(f"Loi khi gui email OTP: {e}")
        return False
