# คู่มือการติดตั้งและใช้งาน (SKILL.md) — AI Group Hub

ทักษะของระบบนี้คือการจัดโครงสร้างเอเจนต์แบบองค์กรขนาดใหญ่ และการรันงานเอเจนต์พร้อมกันแบบประมวลผลคู่ขนาน (DAG Scheduler) พร้อมฟีเจอร์พรีวิวแอพสดบนเบราว์เซอร์

---

## 🚀 1. การเตรียมการและรันฝั่งหลังบ้าน (Backend on ION Server)

เครื่องปลายทาง: **ION Server (`100.96.8.110`)**

### ขั้นตอนการรันหลังบ้านแบบ PM2 (สแตนด์บายตลอดเวลา):
1.  ทำการ SSH เข้าเครื่อง ION Server:
    ```bash
    ssh -i ~/.ssh/id_ed25519 ion20155@100.96.8.110
    ```
2.  ติดตั้ง Dependencies ทั้งหมด (Express และ CORS):
    ```bash
    npm install
    ```
3.  ตรวจสอบการตั้งค่า OpenClaw CLI บนเครื่องว่าผ่านสิทธิ์การใช้งานของ SUT แล้ว:
    ```bash
    openclaw status
    ```
4.  รันหลังบ้านผ่าน **PM2** เพื่อความเสถียรและไม่หลุดการทำงานเมื่อปิดหน้าต่าง SSH:
    ```bash
    # ติดตั้ง PM2
    npm install -g pm2
    
    # รันเซิร์ฟเวอร์ Express
    pm2 start server.js --name "ai-group-backend"
    ```
    เซิร์ฟเวอร์จะรันที่พอร์ต `3000` ของเครื่อง ION Server โดยอัตโนมัติ

---

## 🌐 2. การ Deploy หน้าบ้านขึ้นคลาวด์ (Frontend on Vercel)

ส่วนหน้าบ้านถูก Deploy บน Vercel ผ่านทาง Vercel CLI เพื่อให้รันได้แบบ Serverless และเข้าถึงได้จากทุกอุปกรณ์

### ขั้นตอนการ Deploy:
1.  ติดตั้ง Vercel CLI บนเครื่องภายใน:
    ```bash
    npm install -g vercel
    ```
2.  ทำการสั่งเชื่อมโยงโครงการและสร้างตัวแปรชี้เป้าหลังบ้าน:
    ```bash
    # เริ่มสั่งรัน Deploy
    vercel
    ```
    *   **Project Name**: `ai-group-hub`
    *   **Output Directory**: `dist` (เมื่อคอมไพล์สำเร็จ)
    *   **Environment Variable**: เพิ่มค่าตัวแปร `VITE_API_URL` ชี้ไปที่ Server ION ของเรา:
        *   **Name**: `VITE_API_URL`
        *   **Value**: `http://100.96.8.110:3000`
3.  รันการสร้างการผลิตและปล่อยสู่สาธารณะ (Production Release):
    ```bash
    vercel --prod
    ```
    หลังจากคำสั่งนี้เสร็จสิ้น Vercel จะมอบ URL โดเมนสาธารณะให้คุณ (เช่น `https://ai-group-hub.vercel.app`) เพื่อคลิกเข้าไปใช้งานได้ทันทีจากทุกอุปกรณ์

---

## 🛠️ 3. การอัปโหลดรหัสเข้า GitHub (GitHub Push)

ข้อมูลโค้ดชุดใหม่ทั้งหมดได้ถูกเซ็ตอัป Git และสร้าง Repo ปล่อยขึ้น GitHub เรียบร้อยแล้วที่:
👉 **[https://github.com/b6428259/ai-group-hub](https://github.com/b6428259/ai-group-hub)**

กรณีที่คุณแก้ไขเพิ่มเติมภายในเครื่องและต้องการ Push ขึ้นไปเพิ่มในภายหลัง:
```bash
git add .
git commit -m "update details"
git push origin master
```
