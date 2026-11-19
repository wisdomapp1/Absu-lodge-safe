import type {
  BookingRecord,
  DisputeCase,
  NotificationItem,
  PropertyListing,
} from './types.ts';

export interface ResolvedNotificationDetails {
  notification: NotificationItem;
  categoryLabel: string;
  bookingReference?: string;
  booking?: BookingRecord;
  property?: PropertyListing;
  dispute?: DisputeCase;
}

const BOOKING_REF_REGEX = /ABSU-LS-\d{8}-\d{4}/i;

export function getUnreadNotificationsCount(
  notifications: NotificationItem[],
  recipientUid: string
): number {
  return notifications.filter((n) => n.recipientUid === recipientUid && !n.read).length;
}

export function resolveNotificationDetails(
  notification: NotificationItem,
  context: {
    bookings: BookingRecord[];
    properties: PropertyListing[];
    disputes: DisputeCase[];
  }
): ResolvedNotificationDetails {
  const combinedText = `${notification.title} ${notification.message}`;
  const refMatch = combinedText.match(BOOKING_REF_REGEX);
  const extractedRef = notification.relatedBookingRef || (refMatch ? refMatch[0].toUpperCase() : undefined);

  const booking = extractedRef
    ? context.bookings.find(
        (b) => b.bookingReference.toUpperCase() === extractedRef.toUpperCase()
      )
    : undefined;

  const dispute = notification.relatedDisputeId
    ? context.disputes.find((d) => d.disputeId === notification.relatedDisputeId)
    : extractedRef
      ? context.disputes.find(
          (d) => d.bookingReference.toUpperCase() === extractedRef.toUpperCase()
        )
      : undefined;

  let property = notification.relatedPropertyId
    ? context.properties.find((p) => p.propertyId === notification.relatedPropertyId)
    : undefined;

  if (!property && booking) {
    property = context.properties.find((p) => p.propertyId === booking.propertyId);
  }
  if (!property) {
    const lowerText = combinedText.toLowerCase();
    property = context.properties.find((p) => {
      const shortTitle = p.title.split('—')[0].trim().toLowerCase();
      return shortTitle.length > 4 && lowerText.includes(shortTitle);
    });
  }

  let categoryLabel = 'Platform Alert';
  const cat = notification.category;
  if (cat === 'inspection' || /inspection/i.test(combinedText)) {
    categoryLabel = 'Inspection & Meetup';
  } else if (cat === 'dispute' || /dispute|refund/i.test(combinedText)) {
    categoryLabel = 'Dispute & Refund';
  } else if (cat === 'verification' || /kyc|verification|pending/i.test(combinedText)) {
    categoryLabel = 'SUG Verification';
  } else if (cat === 'payment' || /settlement|payout|payment/i.test(combinedText)) {
    categoryLabel = 'Payment & Settlement';
  } else if (cat === 'booking' || booking) {
    categoryLabel = 'Booking Update';
  }

  return {
    notification,
    categoryLabel,
    bookingReference: extractedRef,
    booking,
    property,
    dispute,
  };
}
