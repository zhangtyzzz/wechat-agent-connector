import type { MessageItem, WeixinInboundEvent, WeixinMessage } from "./types.js";

function bodyFromItemList(itemList?: MessageItem[]): string {
  if (!itemList?.length) return "";
  for (const item of itemList) {
    if (item.type === 1 && item.text_item?.text != null) {
      return String(item.text_item.text);
    }
    if (item.type === 3 && item.voice_item?.text) {
      return item.voice_item.text;
    }
  }
  return "";
}

export function toInboundEvent(accountId: string, message: WeixinMessage): WeixinInboundEvent | null {
  const userId = message.from_user_id?.trim();
  if (!userId) return null;
  return {
    accountId,
    userId,
    messageId: String(message.message_id ?? `${Date.now()}`),
    text: bodyFromItemList(message.item_list),
    contextToken: message.context_token,
    timestamp: message.create_time_ms ?? Date.now(),
    rawMessage: message,
  };
}

