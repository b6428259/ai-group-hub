# คู่มือการติดตั้งและใช้งาน (SKILL.md) — AI Group Hub

ทักษะของระบบนี้คือการจัดโครงสร้างเอเจนต์แบบองค์กรขนาดใหญ่ และการรันงานเอเจนต์พร้อมกันแบบประมวลผลคู่ขนาน (DAG Scheduler) พร้อมฟีเจอร์พรีวิวแอพสดบนเบราว์เซอร์

---

## 🚀 1. การเตรียมการและรันฝั่งหลังบ้าน (Backend on ION Server via Docker Compose)

เครื่องปลายทาง: **ION Server (`100.96.8.110`)**

หลังบ้านในโครงการนี้ได้รับการคอนเทนเนอร์ไรซ์ (Containerized) เรียบร้อยแล้วเพื่อความสะดวกในการย้ายระบบและรันโดยไม่รบกวนโปรแกรมอื่นของเซิร์ฟเวอร์

### ขั้นตอนการรันหลังบ้านด้วย Docker Compose:
1.  ทำการ SSH เข้าเครื่อง ION Server:
    ```bash
    ssh -i ~/.ssh/id_ed25519 ion20155@100.96.8.110
    ```
2.  ไปที่ไดเรกทอรีของโครงการ จากนั้นสั่งสร้างและเปิดใช้งาน Container:
    ```bash
    # สั่งบิลด์และรันตู้คอนเทนเนอร์ในพื้นหลัง (Background Mode)
    docker compose up -d --build
    ```
    *   ระบบจะทำการดึงฐานรูปภาพ Node.js 20-alpine
    *   ทำการแมปพอร์ตจากเครื่องเซิร์ฟเวอร์ `3000` ไปยังตู้คอนเทนเนอร์ `3000`
    *   ทำการเมาท์ไฟล์ตั้งค่าโมเดล `/home/ion20155/.openclaw/agents/main/agent/models.json` ของเครื่องโฮสต์เข้าไปในคอนเทนเนอร์ในโหมดอ่านอย่างเดียว (`ro`) เพื่อนำข้อมูลโมเดลมาใช้โดยอัตโนมัติ

3.  ตรวจสอบสถานะการทำงานของตู้คอนเทนเนอร์:
    ```bash
    docker compose ps
    ```
4.  ตรวจสอบ Log การทำงาน:
    ```bash
    docker compose logs -f
    ```
5.  สั่งปิดการทำงาน:
    ```bash
    docker compose down
    ```

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
