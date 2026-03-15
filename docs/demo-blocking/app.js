const logRoot = document.getElementById("eventLog");
const clearLogBtn = document.getElementById("clearLogBtn");
const loginForm = document.getElementById("loginForm");
const paymentForm = document.getElementById("paymentForm");
const uploadForm = document.getElementById("uploadForm");
const uploadInput = document.getElementById("uploadInput");
const requestSubmitBtn = document.getElementById("requestSubmitBtn");
const downloadButton = document.getElementById("downloadButton");
const downloadChecklistBtn = document.getElementById("downloadChecklistBtn");

const renderEmptyState = () => {
  if (!logRoot) return;
  logRoot.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "log__empty";
  empty.textContent =
    "Журнал пуст. Если действие не заблокировано расширением, здесь появится новая запись.";
  logRoot.appendChild(empty);
};

const addLog = (title, body) => {
  if (!logRoot) return;
  const empty = logRoot.querySelector(".log__empty");
  empty?.remove();

  const item = document.createElement("div");
  item.className = "log__item";

  const time = document.createElement("div");
  time.className = "log__time";
  time.textContent = new Date().toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const heading = document.createElement("div");
  heading.className = "log__title";
  heading.textContent = title;

  const text = document.createElement("div");
  text.className = "log__body";
  text.textContent = body;

  item.appendChild(time);
  item.appendChild(heading);
  item.appendChild(text);
  logRoot.prepend(item);
};

const wireForm = (form, title, detailsBuilder) => {
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    addLog(title, detailsBuilder(new FormData(form)));
  });
};

wireForm(loginForm, "Форма входа отправлена", (data) => {
  const email = data.get("email") || "n/a";
  const password = String(data.get("password") || "");
  const otp = data.get("otp") || "не указан";
  return `E-mail: ${email}. Пароль длиной ${password.length} символов. OTP: ${otp}.`;
});

wireForm(paymentForm, "Форма оплаты отправлена", (data) => {
  const card = String(data.get("card") || "");
  const tail = card.replace(/\s+/g, "").slice(-4) || "n/a";
  return `Платёжная форма прошла submit. Карта заканчивается на ${tail}.`;
});

wireForm(uploadForm, "Файл отправлен", () => {
  const file = uploadInput?.files?.[0];
  if (!file) {
    return "Submit дошёл до страницы, но файл не был выбран.";
  }
  return `На страницу попал файл "${file.name}" размером ${file.size} байт.`;
});

requestSubmitBtn?.addEventListener("click", () => {
  addLog(
    "Вызван requestSubmit()",
    "Если расширение не остановит действие, ниже появится отдельная запись об отправке формы."
  );
  loginForm?.requestSubmit();
});

uploadInput?.addEventListener("change", () => {
  const file = uploadInput.files?.[0];
  if (!file) return;
  addLog("Файл выбран", `Пользователь выбрал локальный файл "${file.name}".`);
});

const triggerDownload = (rawUrl, label) => {
  const url = String(rawUrl || "").trim();
  if (!url) return;
  addLog(label, `Браузер начал загрузку файла ${url}.`);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "";
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

downloadButton?.addEventListener("click", () => {
  triggerDownload(downloadButton.dataset.url, "Запущена загрузка PDF");
});

downloadChecklistBtn?.addEventListener("click", () => {
  triggerDownload(downloadChecklistBtn.dataset.download, "Запущена загрузка TXT");
});

clearLogBtn?.addEventListener("click", renderEmptyState);

renderEmptyState();
