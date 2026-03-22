declare module "qrcode-terminal" {
  export interface GenerateOptions {
    small?: boolean;
  }

  export interface QRCodeTerminal {
    generate(input: string, options?: GenerateOptions, callback?: (qrcode: string) => void): void;
  }

  const qrcodeTerminal: QRCodeTerminal;
  export default qrcodeTerminal;
}

declare module "qrcode" {
  export interface QRCodeToDataURLOptions {
    margin?: number;
    width?: number;
  }

  export function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;

  const QRCode: {
    toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
  };

  export default QRCode;
}
