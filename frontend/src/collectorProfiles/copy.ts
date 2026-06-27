export const COLLECTOR_COPY = {
  productName: "Collector profile",
  tagline: "Show what you collect, list what you trade, and share it all with one link.",

  nav: {
    overview: "Overview",
    cards: "Cards",
    trades: "Trades",
    messages: "Messages",
    viewPublic: "View public page",
  },

  sections: {
    showcase: { label: "Showcase", hint: "Cards you are proud to display" },
    for_trade: { label: "For trade", hint: "Available to swap or sell" },
    wanted: { label: "Wanted list", hint: "Cards you are looking for" },
    private_collection: { label: "Private", hint: "Only visible to you" },
  } as Record<string, { label: string; hint: string }>,

  visibility: {
    private: { label: "Private", hint: "Only you can see your profile" },
    unlisted: { label: "Unlisted", hint: "Anyone with the link can view it" },
    public: { label: "Public", hint: "Discoverable when discovery is enabled" },
  } as Record<string, { label: string; hint: string }>,

  profileStatus: {
    draft: "Draft",
    active: "Live",
    suspended: "Suspended",
  } as Record<string, string>,

  cardStatus: {
    draft: "Draft",
    processing: "Processing",
    ready: "Ready",
    published: "Published",
    archived: "Archived",
  } as Record<string, string>,

  tradeStatus: {
    draft: "Draft",
    sent: "Sent",
    viewed: "Viewed",
    negotiating: "Negotiating",
    accepted: "Accepted",
    declined: "Declined",
    cancelled: "Cancelled",
    completed: "Completed",
  } as Record<string, string>,

  conversationType: {
    direct: "Direct message",
    trade_enquiry: "Trade enquiry",
    card_inquiry: "Card inquiry",
  } as Record<string, string>,

  empty: {
    cards: {
      title: "No cards yet",
      body: "Add your first card to start building your public showcase.",
      action: "Add a card",
    },
    trades: {
      title: "No trade enquiries",
      body: "When someone enquires about a trade, it will appear here.",
    },
    messages: {
      title: "No messages",
      body: "Conversations from trade enquiries and direct messages appear here.",
    },
  },
} as const;

export function sectionLabel(key: string): string {
  return COLLECTOR_COPY.sections[key]?.label ?? key.replace(/_/g, " ");
}

export function formatStatus(
  map: Record<string, string>,
  status: string
): string {
  return map[status] ?? status.replace(/_/g, " ");
}
