# دليل إعداد الشبكة المحلية
# LAN Network Setup Guide

**سوق العقارات — نظام إدارة العقارات**

---

## الفهرس / Table of Contents

1. [متطلبات النظام / System Requirements](#1-متطلبات-النظام--system-requirements)
2. [الإعداد الأول / First-Time Setup](#2-الإعداد-الأول--first-time-setup)
3. [معرفة عنوان IP للخادم / Finding Server IP](#3-معرفة-عنوان-ip-للخادم--finding-server-ip)
4. [تشغيل الخادم / Starting the Server](#4-تشغيل-الخادم--starting-the-server)
5. [الاتصال من الأجهزة الأخرى / Connecting from Other PCs](#5-الاتصال-من-الأجهزة-الأخرى--connecting-from-other-pcs)
6. [إعداد جدار الحماية / Firewall Configuration](#6-إعداد-جدار-الحماية--firewall-configuration)
7. [النسخ الاحتياطي / Database Backup](#7-النسخ-الاحتياطي--database-backup)
8. [حل المشاكل الشائعة / Troubleshooting](#8-حل-المشاكل-الشائعة--troubleshooting)
9. [العمل بدون إنترنت / Offline Operation](#9-العمل-بدون-إنترنت--offline-operation)

---

## المخطط العام / Network Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   شبكة محلية LAN                        │
│                  (192.168.1.x)                           │
│                                                          │
│  ┌──────────────────────────────┐                        │
│  │      🖥️  جهاز الخادم          │  ← يعمل كخادم         │
│  │      SERVER PC               │    (Running as server) │
│  │                              │                        │
│  │  ● Node.js + Express :5000   │                        │
│  │  ● MySQL :3306               │                        │
│  │  ● React SPA (built)         │                        │
│  │                              │                        │
│  │  IP: 192.168.1.100           │                        │
│  └──────────────┬───────────────┘                        │
│                 │ (يخدم الجميع / serves all)              │
│       ┌─────────┼─────────┐                              │
│       ▼         ▼         ▼                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                    │
│  │ 🖥️ PC 2  │ │ 🖥️ PC 3  │ │ 🖥️ PC 4  │  ← عملاء Clients  │
│  │ .101    │ │ .102    │ │ .103    │                    │
│  │ Browser │ │ Browser │ │ Browser │                    │
│  └─────────┘ └─────────┘ └─────────┘                    │
└─────────────────────────────────────────────────────────┘

كل جهاز عميل يفتح:   http://192.168.1.100:5000
Each client opens:   http://SERVER_IP:5000
```

---

## 1. متطلبات النظام / System Requirements

### جهاز الخادم (Server PC)

| المتطلب | الإصدار الأدنى |
|---------|---------------|
| Windows | 10 / 11 |
| Node.js | 18.x LTS |
| MySQL   | 8.0 |
| RAM     | 4 GB |
| مساحة خالية | 10 GB |

### أجهزة العملاء (Client PCs)

- أي متصفح حديث (Chrome, Edge, Firefox)
- **لا يوجد تثبيت مطلوب** — فقط متصفح ويب

---

## 2. الإعداد الأول / First-Time Setup

### الخطوة 1 — تثبيت Node.js

1. حمّل Node.js من: https://nodejs.org (أختر LTS)
2. ثبّته بالإعدادات الافتراضية
3. تحقق من التثبيت:
   ```
   node --version
   npm --version
   ```

### الخطوة 2 — تثبيت MySQL

1. حمّل MySQL Community Server من: https://dev.mysql.com/downloads/mysql/
2. أثناء التثبيت، اختر:
   - Type: **Development Computer**
   - Authentication: **Legacy Authentication**
   - اختر كلمة مرور قوية للـ root
3. تأكد أن MySQL يبدأ تلقائياً مع Windows (خدمة MySQL80)

### الخطوة 3 — إعداد قاعدة البيانات

**الطريقة السهلة — سكريبت تلقائي:**
```
scripts\setup-database.bat
```

**أو يدوياً:**
```sql
-- افتح MySQL Workbench أو Command Line
mysql -u root -p

CREATE DATABASE IF NOT EXISTS real_estate_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'rems_user'@'localhost'
  IDENTIFIED BY 'اختر_كلمة_مرور_قوية';

GRANT ALL PRIVILEGES ON real_estate_db.* TO 'rems_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

-- ثم شغّل ملف قاعدة البيانات:
mysql -u root -p real_estate_db < database\database.sql
```

### الخطوة 4 — إعداد ملف البيئة

```bat
cd backend
copy .env.production .env
notepad .env
```

عدّل هذه القيم الأساسية:
```
DB_PASSWORD=كلمة_المرور_التي_اخترتها
JWT_SECRET=سلسلة_عشوائية_طويلة_64_حرف
JWT_REFRESH_SECRET=سلسلة_عشوائية_أخرى_64_حرف
```

لتوليد مفاتيح JWT:
```
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### الخطوة 5 — تثبيت المكتبات

```bat
:: Backend
cd backend
npm install

:: Frontend
cd ..\frontend
npm install
```

---

## 3. معرفة عنوان IP للخادم / Finding Server IP

**الطريقة 1 — السكريبت المخصص:**
```bat
scripts\find-ip.bat
```

**الطريقة 2 — يدوياً:**
```bat
ipconfig
```
ابحث عن: `IPv4 Address . . . . . . : 192.168.1.XXX`
تحت البطاقة الشبكية الصحيحة (Ethernet أو Wi-Fi).

**مثال على الخرج:**
```
Ethernet adapter Local Area Connection:
   IPv4 Address. . . . . . . . . . . : 192.168.1.100  ← هذا هو عنوانك
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 192.168.1.1
```

> **نصيحة:** اجعل عنوان IP الخادم ثابتاً (Static IP) حتى لا يتغير.
> اذهب إلى: لوحة التحكم → مركز الشبكة → إعدادات المحول → TCP/IPv4

---

## 4. تشغيل الخادم / Starting the Server

### التشغيل العادي (خيار مُوصى للإنتاج)

```bat
scripts\start-server.bat
```

هذا السكريبت يقوم بـ:
1. بناء الواجهة الأمامية (React → ملفات ثابتة)
2. نسخ الملفات إلى `backend/public`
3. تشغيل Node.js على المنفذ 5000

**بعد البدء ستظهر:**
```
[INFO] Server running on http://0.0.0.0:5000 [production]
```

### التشغيل للتطوير (development)

```bat
scripts\start-dev.bat
```

يفتح نافذتين:
- Backend: http://localhost:5000
- Frontend: http://localhost:3000

### التأكد من أن الخادم يعمل

افتح في المتصفح على **نفس الجهاز**:
- http://localhost:5000/health

يجب أن يظهر:
```json
{ "status": "ok", "environment": "production" }
```

---

## 5. الاتصال من الأجهزة الأخرى / Connecting from Other PCs

### على كل جهاز عميل:

1. افتح المتصفح (Chrome أو Edge)
2. اكتب في شريط العنوان:
   ```
   http://192.168.1.100:5000
   ```
   (استبدل `192.168.1.100` بـ IP جهاز الخادم الفعلي)

3. يجب أن تظهر صفحة تسجيل الدخول

### بيانات الدخول الافتراضية:

| الحقل | القيمة |
|-------|--------|
| البريد الإلكتروني | admin@test.com |
| كلمة المرور | Admin@123456 |

> **تحذير:** غيّر كلمة المرور فوراً بعد أول تسجيل دخول!
> اذهب إلى: المستخدمون ← اضغط على حسابك ← تغيير كلمة المرور

### اختصار عملي: إنشاء ملف shortcut

على كل جهاز عميل، أنشئ اختصاراً على سطح المكتب:
1. كليك يمين على سطح المكتب → جديد → اختصار
2. الموقع: `http://192.168.1.100:5000`
3. الاسم: `سوق العقارات`

---

## 6. إعداد جدار الحماية / Firewall Configuration

يجب فتح المنفذ **5000** على جهاز الخادم للسماح للأجهزة الأخرى بالاتصال.

### Windows Defender Firewall — طريقة سريعة

افتح **موجه الأوامر (CMD) كمدير** وشغّل:

```bat
:: فتح المنفذ 5000 للشبكة المحلية
netsh advfirewall firewall add rule ^
  name="REMS App Port 5000" ^
  dir=in ^
  action=allow ^
  protocol=TCP ^
  localport=5000 ^
  profile=private ^
  description="Souq Al-Aqarat Real Estate Management System"

echo [OK] Port 5000 opened for LAN connections.
```

أو عبر واجهة Windows:

1. ابحث عن: **Windows Defender Firewall** في قائمة ابدأ
2. اختر: **Advanced settings**
3. **Inbound Rules** → **New Rule**
4. اختر: **Port** → Next
5. TCP → Specific local ports: **5000** → Next
6. **Allow the connection** → Next
7. علّم فقط: **Private** (الشبكة الخاصة) → Next
8. الاسم: `REMS Port 5000` → Finish

### للتحقق من أن الفتح نجح

من جهاز آخر، افتح CMD واكتب:
```
telnet 192.168.1.100 5000
```
إذا فتح الاتصال (شاشة سوداء) = المنفذ مفتوح ✓

---

## 7. النسخ الاحتياطي / Database Backup

### نسخ احتياطي يدوي

```bat
scripts\backup-database.bat
```

الملفات تُحفظ في: `database\backups\rems_backup_YYYY-MM-DD_HH-MM.sql`

### نسخ احتياطي تلقائي (يومي)

لجدولة نسخ احتياطي يومي باستخدام **Windows Task Scheduler**:

1. افتح **Task Scheduler** من قائمة ابدأ
2. اختر: **Create Basic Task**
3. الاسم: `REMS Daily Backup`
4. Trigger: **Daily** → اختر الوقت (مثلاً 11:00 PM)
5. Action: **Start a Program**
6. Program: `C:\path\to\project\scripts\backup-database.bat`
7. Finish

> يُحتفظ تلقائياً بآخر 30 نسخة احتياطية. الأقدم تُحذف تلقائياً.

### استعادة نسخة احتياطية

```bat
scripts\restore-database.bat
```

### نسخ احتياطي يدوي عبر سطر الأوامر

```bat
mysqldump -u rems_user -p real_estate_db > backup_%date:~10,4%-%date:~4,2%-%date:~7,2%.sql
```

---

## 8. حل المشاكل الشائعة / Troubleshooting

### ❌ الأجهزة الأخرى لا تستطيع الاتصال

**التحقق:**
1. هل المنفذ 5000 مفتوح في جدار الحماية؟ (راجع القسم 6)
2. هل الأجهزة على نفس الشبكة؟
   ```bat
   ping 192.168.1.100    ← من جهاز العميل
   ```
3. هل الخادم يعمل؟
   ```bat
   netstat -an | findstr :5000   ← على جهاز الخادم
   ```
   يجب أن ترى: `0.0.0.0:5000  LISTENING`

4. هل IP الخادم صحيح؟
   ```bat
   ipconfig   ← على جهاز الخادم
   ```

**الحل الشائع:**
```bat
:: تعطيل جدار الحماية مؤقتاً للاختبار (ثم أعده)
netsh advfirewall set privateprofile state off
:: بعد الاختبار:
netsh advfirewall set privateprofile state on
```

---

### ❌ خطأ CORS

**الأعراض:** `Access-Control-Allow-Origin` في console المتصفح.

**الحل:** أضف IP جهاز العميل إلى `CORS_ORIGINS` في `backend\.env`:
```
CORS_ORIGINS=http://192.168.1.100:5000,http://192.168.1.101:5000,http://192.168.1.102:5000
```
ثم أعد تشغيل الخادم.

---

### ❌ لا يمكن الاتصال بقاعدة البيانات

**التحقق:**
```bat
:: هل MySQL يعمل؟
net start | findstr MySQL

:: تشغيله إذا لم يكن يعمل:
net start MySQL80
```

---

### ❌ صفحة البيضاء أو 404 بعد تسجيل الدخول

**السبب:** الواجهة الأمامية لم تُنسخ إلى `backend/public`.

**الحل:** أعد تشغيل `start-server.bat` ليعيد البناء والنسخ.

---

### ❌ IP الخادم يتغير بعد إعادة التشغيل

**الحل:** اجعل IP الخادم ثابتاً:

1. Control Panel → Network → Change adapter settings
2. كليك يمين على البطاقة الشبكية → Properties
3. اختر IPv4 → Properties
4. اختر "Use the following IP address"
5. IP: `192.168.1.100` (أو أي عنوان ثابت)
6. Subnet: `255.255.255.0`
7. Gateway: `192.168.1.1` (أو عنوان الراوتر)

---

## 9. العمل بدون إنترنت / Offline Operation

النظام مصمم للعمل بالكامل بدون إنترنت. إليك ما تحتاج إليه:

### ما يعمل بدون إنترنت ✅

- تسجيل الدخول والمصادقة
- إضافة وتعديل وحذف العقارات
- إضافة وتعديل العملاء
- رفع صور العقارات
- التقارير والإحصائيات
- لوحة التحكم

### ما يحتاج إنترنت ⚠️

- الخطوط العربية (Cairo) وخطوط Poppins من Google Fonts

### إعداد الخطوط بدون إنترنت

#### الطريقة 1 — تنزيل الخطوط مسبقاً (مُوصى)

1. حمّل الخطوط من Google Fonts:
   - Cairo: https://fonts.google.com/specimen/Cairo
   - Poppins: https://fonts.google.com/specimen/Poppins

2. ضع الملفات في: `frontend/public/fonts/`
   ```
   public/
   └── fonts/
       ├── Cairo-Regular.woff2
       ├── Cairo-Medium.woff2
       ├── Cairo-SemiBold.woff2
       ├── Cairo-Bold.woff2
       ├── Cairo-ExtraBold.woff2
       ├── Poppins-Regular.woff2
       ├── Poppins-Medium.woff2
       ├── Poppins-SemiBold.woff2
       └── Poppins-Bold.woff2
   ```

3. عدّل `frontend/src/styles/index.css` — استبدل السطر الأول:
   ```css
   /* احذف هذا السطر: */
   @import url('https://fonts.googleapis.com/css2?...');

   /* واستبدله بهذا: */
   @font-face {
     font-family: 'Cairo';
     src: url('/fonts/Cairo-Regular.woff2') format('woff2');
     font-weight: 400;
   }
   @font-face {
     font-family: 'Cairo';
     src: url('/fonts/Cairo-Bold.woff2') format('woff2');
     font-weight: 700;
   }
   @font-face {
     font-family: 'Poppins';
     src: url('/fonts/Poppins-Regular.woff2') format('woff2');
     font-weight: 400;
   }
   @font-face {
     font-family: 'Poppins';
     src: url('/fonts/Poppins-Bold.woff2') format('woff2');
     font-weight: 700;
   }
   ```

4. احذف رابط Google Fonts من `frontend/index.html`
5. أعد بناء الواجهة: `npm run build`

---

## ملخص سريع / Quick Reference Card

```
┌────────────────────────────────────────────────────────────┐
│            سوق العقارات — بطاقة مرجعية سريعة               │
├────────────────────────────────────────────────────────────┤
│  بدء النظام        │  scripts\start-server.bat              │
│  نسخة احتياطية     │  scripts\backup-database.bat           │
│  معرفة IP الخادم   │  scripts\find-ip.bat                   │
│  إعداد قاعدة بيانات│  scripts\setup-database.bat            │
│  وضع التطوير       │  scripts\start-dev.bat                 │
├────────────────────────────────────────────────────────────┤
│  رابط النظام       │  http://SERVER_IP:5000                 │
│  فحص صحة الخادم   │  http://SERVER_IP:5000/health          │
│  API Status        │  http://SERVER_IP:5000/api/v1/status   │
├────────────────────────────────────────────────────────────┤
│  المنافذ المستخدمة │                                        │
│    Node.js/App     │  :5000  (يجب فتحه في الـ Firewall)     │
│    MySQL           │  :3306  (محلي فقط، لا تفتحه)          │
├────────────────────────────────────────────────────────────┤
│  بيانات الدخول     │                                        │
│    Admin           │  admin@test.com / Admin@123456         │
│    ⚠️ غيّر الكلمة  │  فوراً بعد أول تسجيل دخول!             │
└────────────────────────────────────────────────────────────┘
```

---

*آخر تحديث: 2026 — سوق العقارات للتسويق العقاري*
