export const log = {
  info: (msg: string, data?: any) => {
    const time = new Date().toISOString().slice(11, 19);
    console.log(`[${time}] ℹ️  ${msg}`, data ? JSON.stringify(data) : "");
  },
  success: (msg: string, data?: any) => {
    const time = new Date().toISOString().slice(11, 19);
    console.log(`[${time}] ✅ ${msg}`, data ? JSON.stringify(data) : "");
  },
  error: (msg: string, err?: any) => {
    const time = new Date().toISOString().slice(11, 19);
    console.error(`[${time}] ❌ ${msg}`, err?.message || err || "");
  },
  warn: (msg: string) => {
    const time = new Date().toISOString().slice(11, 19);
    console.warn(`[${time}] ⚠️  ${msg}`);
  },
};
