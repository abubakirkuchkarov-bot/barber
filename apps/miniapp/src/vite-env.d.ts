/// <reference types="vite/client" />

interface TelegramTheme {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  themeParams: TelegramTheme;
  onEvent: (event: string, handler: () => void) => void;
  offEvent: (event: string, handler: () => void) => void;
}

interface Window {
  Telegram?: { WebApp: TelegramWebApp };
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WEB_ORIGIN?: string;
  readonly DEV: boolean;
}
