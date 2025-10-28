import type { CvListItem } from "@/lib/cv/search";
import type { SavedSearchDocument } from "@/lib/db/collections";

export interface NotificationResult {
  channel: "email" | "webhook";
  success: boolean;
  message?: string;
}

interface WebhookPayload {
  savedSearchId: string;
  name: string;
  matchCount: number;
  matches: Array<{
    id: string;
    consultant: CvListItem["consultant"];
    availability: CvListItem["availability"];
    skills: CvListItem["skills"];
  }>;
}

export async function deliverSavedSearchNotifications(
  savedSearch: SavedSearchDocument,
  matches: CvListItem[]
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = [];

  if (savedSearch.notifications.email?.enabled) {
    const recipients = savedSearch.notifications.email.recipients ?? [];
    console.log("[saved-search] sending email notification", {
      savedSearchId: savedSearch._id?.toHexString(),
      recipients,
      matchCount: matches.length
    });
    results.push({ channel: "email", success: true });
  }

  if (savedSearch.notifications.webhook?.enabled && savedSearch.notifications.webhook.url) {
    const payload: WebhookPayload = {
      savedSearchId: savedSearch._id?.toHexString() ?? "",
      name: savedSearch.name,
      matchCount: matches.length,
      matches: matches.map((match) => ({
        id: match.id,
        consultant: match.consultant,
        availability: match.availability,
        skills: match.skills
      }))
    };

    try {
      await fetch(savedSearch.notifications.webhook.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(savedSearch.notifications.webhook.secret
            ? { "x-search-signature": savedSearch.notifications.webhook.secret }
            : {})
        },
        body: JSON.stringify(payload)
      });
      results.push({ channel: "webhook", success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to deliver webhook";
      console.error("[saved-search] webhook delivery failed", {
        savedSearchId: savedSearch._id?.toHexString(),
        url: savedSearch.notifications.webhook.url,
        error: message
      });
      results.push({ channel: "webhook", success: false, message });
    }
  }

  return results;
}

