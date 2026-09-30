/** Coarse device facts from a User-Agent string, for usage statistics. */
export interface Device {
  device: "mobile" | "tablet" | "desktop" | "bot" | "script" | "";
  os: string;
  browser: string;
  inApp: string;
}

const first = (ua: string, rules: [RegExp, string][]) => rules.find(([re]) => re.test(ua))?.[1] ?? "";

export function parseUserAgent(ua: string): Device {
  if (!ua) return { device: "", os: "", browser: "", inApp: "" };
  if (/curl|wget|python|axios|node-fetch|undici|go-http|okhttp|java\/|postman|httpclient/i.test(ua))
    return { device: "script", os: "", browser: first(ua, [[/curl/i, "curl"], [/python/i, "Python"], [/postman/i, "Postman"]]) || "script", inApp: "" };
  if (/bot|crawl|spider|slurp|facebookexternalhit|preview|headless/i.test(ua)) return { device: "bot", os: "", browser: "", inApp: "" };
  const os = first(ua, [
    [/Android/, "Android"], [/iPhone|iPad|iPod/, "iOS"], [/CrOS/, "ChromeOS"], [/Windows/, "Windows"],
    [/Macintosh|Mac OS X/, "macOS"], [/KAIOS/i, "KaiOS"], [/Linux/, "Linux"],
  ]);
  const inApp = first(ua, [
    [/FBAN|FBAV|FB_IAB/, "Facebook"], [/Instagram/, "Instagram"], [/musical_ly|TikTok|BytedanceWebview/, "TikTok"],
    [/\bLine\//, "LINE"], [/Twitter/, "X / Twitter"], [/GSA\//, "Google app"], [/WhatsApp/, "WhatsApp"], [/Telegram/, "Telegram"],
  ]);
  const browser = first(ua, [
    [/Edg\//, "Edge"], [/OPR\/|Opera/, "Opera"], [/SamsungBrowser/, "Samsung Internet"], [/UCBrowser/, "UC Browser"],
    [/MiuiBrowser/, "Mi Browser"], [/Firefox|FxiOS/, "Firefox"], [/Chrome|CriOS/, "Chrome"], [/Safari/, "Safari"],
  ]);
  const device = /iPad|Tablet|Android(?!.*Mobile)/.test(ua) ? "tablet" : /Mobi|iPhone|Android/.test(ua) ? "mobile" : "desktop";
  return { device, os, browser, inApp };
}
