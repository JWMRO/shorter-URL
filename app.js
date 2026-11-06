"use strict";

const STORAGE_KEY = "short-url-mappings-v1";
const CODE_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE_LENGTH = 7;

const form = document.querySelector("#shorten-form");
const urlInput = document.querySelector("#url");
const statusMessage = document.querySelector("#status");
const resultSection = document.querySelector("#result");
const shortUrlInput = document.querySelector("#short-url");
const copyButton = document.querySelector("#copy-btn");
const historySection = document.querySelector("#history");
const historyList = document.querySelector("#history-list");

function isHttpUrl(value) {
    try {
        const url = new URL(value);
        return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
    } catch {
        return false;
    }
}

function readMappings() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
        return {};
    }

    const parsed = JSON.parse(stored);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("短網址資料格式錯誤。");
    }

    for (const [code, destination] of Object.entries(parsed)) {
        if (!new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(code) ||
            typeof destination !== "string" ||
            !isHttpUrl(destination)) {
            throw new Error("短網址資料格式錯誤。");
        }
    }

    return parsed;
}

let mappings;
try {
    mappings = readMappings();
} catch (error) {
    mappings = {};
    statusMessage.textContent = `無法讀取本機短網址資料：${error.message} 請檢查瀏覽器儲存空間後重新載入。`;
    form.querySelector("button").disabled = true;
}

function makeCode() {
    const randomValues = new Uint32Array(CODE_LENGTH);
    crypto.getRandomValues(randomValues);
    return Array.from(randomValues, value => CODE_ALPHABET[value % CODE_ALPHABET.length]).join("");
}

function makeShortUrl(code) {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = `s=${code}`;
    return url.href;
}

function renderHistory() {
    historyList.replaceChildren();
    const entries = Object.entries(mappings).reverse();
    historySection.hidden = entries.length === 0;

    for (const [code, destination] of entries) {
        const item = document.createElement("li");
        const shortLink = document.createElement("a");
        shortLink.href = makeShortUrl(code);
        shortLink.textContent = shortLink.href;
        const destinationText = document.createElement("span");
        destinationText.className = "muted";
        destinationText.textContent = destination;
        item.append(shortLink, destinationText);
        historyList.append(item);
    }
}

function redirectIfShortLink() {
    const shortCode = new URLSearchParams(window.location.hash.slice(1)).get("s");
    if (shortCode === null) {
        return;
    }

    const destination = mappings[shortCode];
    if (destination) {
        window.location.replace(destination);
        return;
    }

    statusMessage.textContent = "找不到這個短網址。它可能是在其他瀏覽器建立，或已清除本機資料。";
}

window.addEventListener("hashchange", redirectIfShortLink);

form.addEventListener("submit", event => {
    event.preventDefault();
    const destination = urlInput.value.trim();

    if (!isHttpUrl(destination)) {
        statusMessage.textContent = "請輸入有效的 http:// 或 https:// 網址。";
        urlInput.focus();
        return;
    }

    const existing = Object.entries(mappings).find(([, value]) => value === destination);
    let code = existing?.[0];
    if (!code) {
        for (let attempt = 0; attempt < 10; attempt += 1) {
            const candidate = makeCode();
            if (!Object.hasOwn(mappings, candidate)) {
                code = candidate;
                break;
            }
        }
    }

    if (!code) {
        statusMessage.textContent = "目前無法產生唯一短碼，請再試一次。";
        return;
    }

    if (!existing) {
        const updatedMappings = { ...mappings, [code]: destination };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMappings));
        } catch (error) {
            statusMessage.textContent = `無法儲存短網址：${error.message} 請檢查瀏覽器儲存空間。`;
            return;
        }
        mappings = updatedMappings;
    }

    shortUrlInput.value = makeShortUrl(code);
    resultSection.hidden = false;
    statusMessage.textContent = existing ? "這個網址已存在，已顯示原有短網址。" : "短網址已產生並儲存。";
    renderHistory();
});

copyButton.addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(shortUrlInput.value);
        statusMessage.textContent = "短網址已複製。";
    } catch (error) {
        statusMessage.textContent = `無法複製短網址：${error.message} 請手動選取並複製。`;
        shortUrlInput.focus();
        shortUrlInput.select();
    }
});

renderHistory();
redirectIfShortLink();
