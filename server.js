const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public"))); // يخدم ملفات HTML و CSS و JS

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "chatomegel.html"));
});

let waitingUser = null; // لتخزين المستخدم المنتظر
const activeChats = new Map(); // لتخزين الدردشات النشطة

io.on("connection", (socket) => {
    console.log(`مستخدم متصل: ${socket.id}`);

    // عند طلب بدء الدردشة
    socket.on("findPartner", () => {
        if (waitingUser) {
            // يربط المستخدم المنتظر بالمستخدم الجديد
            activeChats.set(socket.id, waitingUser);
            activeChats.set(waitingUser, socket.id);
            io.to(socket.id).emit("chatConnected");
            io.to(waitingUser).emit("chatConnected");
            waitingUser = null;
        } else {
            // لا يوجد مستخدم منتظر، ضع المستخدم في قائمة الانتظار
            waitingUser = socket.id;
        }
    });

    // استقبال الرسائل وإرسالها للطرف الآخر
    socket.on("message", (msg) => {
        const partner = activeChats.get(socket.id);
        if (partner) {
            io.to(partner).emit("message", msg);
        }
    });

    // استقبال الإيموجي وإرسالها للطرف الآخر
    socket.on("emoji", (emoji) => {
        const partner = activeChats.get(socket.id);
        if (partner) {
            io.to(partner).emit("emoji", emoji);
        }
    });

    // عند قطع الاتصال
    socket.on("disconnect", () => {
        console.log(`مستخدم قطع الاتصال: ${socket.id}`);
        const partner = activeChats.get(socket.id);
        if (partner) {
            io.to(partner).emit("partnerDisconnected");
            activeChats.delete(partner);
        }
        activeChats.delete(socket.id);

        // إذا كان المستخدم المنتظر هو الذي خرج
        if (waitingUser === socket.id) {
            waitingUser = null;
        }
    });

    // عند الضغط على زر "قطع الاتصال"
    socket.on("leaveChat", () => {
        const partner = activeChats.get(socket.id);
        if (partner) {
            io.to(partner).emit("partnerDisconnected");
            activeChats.delete(partner);
        }
        activeChats.delete(socket.id);

        // إرسال المستخدم إلى الانتظار مرة أخرى
        socket.emit("findPartner");
    });
});

const PORT = 6000;
server.listen(PORT, () => {
    console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
});
