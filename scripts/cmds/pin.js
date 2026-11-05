Cmd install pin. Js 
const axios = require("axios");
const { createCanvas, loadImage } = require("canvas");
const fs = require("fs-extra");
const path = require("path");
const { getStreamFromURL } = global.utils;

const CACHE = path.join(__dirname, "cache");
const API_URL = "https://egret-driving-cattle.ngrok-free.app/api/pin";

const IMAGES_PER_PAGE = 21;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1600;

const sessions = new Map();

module.exports = {
  config: {
    name: "pinterest",
    aliases: ["pin", "Pinterest"],
    version: "3.0.0",
    author: "Mahi--",
    countDown: 10,
    role: 0,
    shortDescription: "Search Pinterest images",
    longDescription: "Search Pinterest, browse image previews, and download images.",
    category: "Image",
    guide: {
      en:
        "{pn} query [-count]\n" +
        "Example: {pn} anime wallpaper\n" +
        "Example: {pn} cute cat -5\n" +
        "Reply with a number to get an image.\n" +
        "Reply next for more results."
    }
  },

  onStart: async function ({ args, message, event }) {
    let processing;

    try {
      let count = null;

      const countArg = args.find(arg => /^-\d+$/.test(arg));

      if (countArg) {
        count = parseInt(countArg.slice(1), 10);
        args = args.filter(arg => arg !== countArg);

        if (count < 1 || count > 21) {
          return message.reply("Please choose a count between 1 and 21.");
        }
      }

      const query = args.join(" ").trim();

      if (!query) {
        return message.reply("Please provide a search query.");
      }

      processing = await message.reply("🔍 Searching Pinterest...");

      const response = await axios.get(API_URL, {
        params: {
          query,
          num: 90
        },
        timeout: 30000
      });

      const results = response.data?.results;

      if (!Array.isArray(results) || results.length === 0) {
        await message.unsend(processing.messageID).catch(() => {});
        return message.reply("No images found for this search.");
      }

      const allImageUrls = results
        .filter(url => typeof url === "string" && /^https?:\/\//i.test(url));

      if (allImageUrls.length === 0) {
        await message.unsend(processing.messageID).catch(() => {});
        return message.reply("No valid image links were returned.");
      }

      if (count) {
        const selected = allImageUrls.slice(0, count);

        const streams = await Promise.all(
          selected.map(url =>
            getStreamFromURL(url).catch(() => null)
          )
        );

        const validStreams = streams.filter(Boolean);

        await message.unsend(processing.messageID).catch(() => {});

        if (validStreams.length === 0) {
          return message.reply("Failed to download the images.");
        }

        return message.reply({
          body: `Found ${validStreams.length} images for "${query}".`,
          attachment: validStreams
        });
      }

      const session = {
        author: event.senderID,
        query,
        allImageUrls,
        currentPage: 1,
        totalPages: Math.ceil(allImageUrls.length / IMAGES_PER_PAGE)
      };

      const canvasPath = await createPage(session, 1);

      const sentMessage = await message.reply({
        body:
          `🖼️ Found ${allImageUrls.length} images for "${query}".\n` +
          "Reply with a number to download an image, or next for more.",
        attachment: fs.createReadStream(canvasPath)
      });

      sessions.set(sentMessage.messageID, session);

      await fs.remove(canvasPath).catch(() => {});
      await message.unsend(processing.messageID).catch(() => {});

    } catch (error) {
      console.error("Pinterest error:", error);

      if (processing) {
        await message.unsend(processing.messageID).catch(() => {});
      }

      return message.reply(
        "Pinterest search failed. Please try again later."
      );
    }
  },

  onReply: async function ({ event, message, Reply }) {
    try {
      if (!Reply) {
        return message.reply("Session expired. Please search again.");
      }

      const session = sessions.get(Reply.messageID) || Reply;

      if (event.senderID !== session.author) return;

      const input = (event.body || "").trim().toLowerCase();

      if (input === "next") {
        if (session.currentPage >= session.totalPages) {
          return message.reply("You are already on the last page.");
        }

        const nextPage = session.currentPage + 1;
        const processing = await message.reply("Loading next page...");

        const canvasPath = await createPage(session, nextPage);

        const sentMessage = await message.reply({
          body:
            `🖼️ Page ${nextPage}/${session.totalPages}\n` +
            "Reply with a number to download an image, or next for more.",
          attachment: fs.createReadStream(canvasPath)
        });

        sessions.set(sentMessage.messageID, {
          ...session,
          currentPage: nextPage
        });

        await fs.remove(canvasPath).catch(() => {});
        await message.unsend(processing.messageID).catch(() => {});

        return;
      }

      const number = Number(input);

      if (!Number.isInteger(number) || number < 1 || number > IMAGES_PER_PAGE) {
        return message.reply(
          'Reply with a number from 1 to 21, or type "next".'
        );
      }

      const startIndex = (session.currentPage - 1) * IMAGES_PER_PAGE;
      const imageUrl = session.allImageUrls[startIndex + number - 1];

      if (!imageUrl) {
        return message.reply("That image does not exist on this page.");
      }

      const stream = await getStreamFromURL(imageUrl).catch(() => null);

      if (!stream) {
        return message.reply("Failed to download this image.");
      }

      return message.reply({
        body: `Image #${number} for "${session.query}"`,
        attachment: stream
      });

    } catch (error) {
      console.error("Pinterest reply error:", error);
      return message.reply("Something went wrong. Please try again.");
    }
  }
};

async function createPage(session, page) {
  await fs.ensureDir(CACHE);

  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Pinterest Searcher", 20, 40);

  ctx.font = "15px Arial";
  ctx.fillStyle = "#b0b0b0";
  ctx.fillText(
    `Search: ${session.query}`.slice(0, 85),
    20,
    70
  );

  const start = (page - 1) * IMAGES_PER_PAGE;
  const urls = session.allImageUrls.slice(
    start,
    start + IMAGES_PER_PAGE
  );

  const padding = 15;
  const columns = 3;
  const columnWidth = (CANVAS_WIDTH - padding * 4) / columns;
  const columnHeights = [100, 100, 100];

  for (let i = 0; i < urls.length; i++) {
    let img;

    try {
      img = await loadImage(urls[i]);
    } catch (error) {
      console.error("Image load failed:", urls[i]);
      continue;
    }

    const column = columnHeights.indexOf(Math.min(...columnHeights));
    const x = padding + column * (columnWidth + padding);
    const y = columnHeights[column] + padding;

    const scale = Math.min(
      columnWidth / img.width,
      450 / img.height
    );

    const width = img.width * scale;
    const height = img.height * scale;

    ctx.save();

    ctx.beginPath();
    ctx.rect(x, y, columnWidth, height);
    ctx.clip();

    ctx.drawImage(img, x, y, width, height);

    ctx.restore();

    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(x, y, 50, 25);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`#${i + 1}`, x + 25, y + 17);

    columnHeights[column] += height + padding;
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    `Page ${page}/${session.totalPages}`,
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT - 25
  );

  const outputPath = path.join(
    CACHE,
    `pinterest_${Date.now()}.png`
  );

  await fs.writeFile(outputPath, canvas.toBuffer("image/png"));

  return outputPath;
                 }
