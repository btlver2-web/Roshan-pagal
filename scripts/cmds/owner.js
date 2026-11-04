const fs = require("fs-extra");
const request = require("request");
const path = require("path");

module.exports = {
  config: {
    name: "owner",
    version: "1.4.0",
    author: "su baru",
    role: 0,
    shortDescription: "Premium owner information",
    category: "Information",
    guide: {
      en: "owner"
    }
  },

  onStart: async function ({ api, event }) {
    const ownerText =
`╭━━━〔 👑 OWNER PROFILE 👑 〕━━━╮
┃
┃ 👤 Name       : su baru
┃ 🧑‍💻 Developer : Aryian bhauu
┃ 🤖 Bot        : REM...X...ST
┃ ⚙️ Version    : 3.0.00
┃
┣━━━〔 🔗 CONTACT INFO 〕━━━
┃
┃ 💬 Messenger:
┃ m.me/61595801918962
┃
┃ 📘 Facebook:
┃ https://www.facebook.com/profile.php?id=61592422092604
┃
╰━━━━━━━━━━━━━━━━━━━━╯
     ❤️ Thanks for using REM...X...ST`;

    const cacheDir = path.join(__dirname, "cache");
    const imgPath = path.join(cacheDir, "owner.jpg");

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const imgLink = "https://i.imgur.com/2UTogei.jpeg";

    request(imgLink)
      .on("error", (err) => {
        console.error("Owner image download failed:", err);
        api.sendMessage(ownerText, event.threadID, null, event.messageID);
      })
      .pipe(fs.createWriteStream(imgPath))
      .on("finish", () => {
        api.sendMessage(
          {
            body: ownerText,
            attachment: fs.createReadStream(imgPath)
          },
          event.threadID,
          (err) => {
            if (fs.existsSync(imgPath)) {
              fs.unlinkSync(imgPath);
            }
            if (err) console.error(err);
          },
          event.messageID
        );
      });
  }
};
