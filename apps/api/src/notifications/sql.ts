const clientScope = "AND ($CLIENT::uuid IS NULL OR b.client_id = $CLIENT::uuid)";

export const claimDaySql = `
UPDATE bookings AS b
SET reminder_day_sent_at = $1::timestamptz
WHERE b.status = 'confirmed'
  AND b.reminder_day_sent_at IS NULL
  AND b.starts_at > $1::timestamptz + ($3::int * INTERVAL '1 minute')
  AND b.starts_at <= $1::timestamptz + ($2::int * INTERVAL '1 minute')
  AND EXISTS (
    SELECT 1 FROM clients AS c
    WHERE c.id = b.client_id AND c.telegram_chat_id IS NOT NULL
  )
  ${clientScope.replaceAll("$CLIENT", "$4")}
RETURNING b.id::text AS id
`;

export const claimShortSql = `
UPDATE bookings AS b
SET reminder_30m_sent_at = $1::timestamptz
WHERE b.status = 'confirmed'
  AND b.reminder_30m_sent_at IS NULL
  AND b.starts_at > $1::timestamptz
  AND b.starts_at <= $1::timestamptz + ($2::int * INTERVAL '1 minute')
  AND EXISTS (
    SELECT 1 FROM clients AS c
    WHERE c.id = b.client_id AND c.telegram_chat_id IS NOT NULL
  )
  ${clientScope.replaceAll("$CLIENT", "$3")}
RETURNING b.id::text AS id
`;

export const claimReviewSql = `
UPDATE bookings AS b
SET review_requested_at = $1::timestamptz
WHERE b.status = 'completed'
  AND b.review_requested_at IS NULL
  AND b.ends_at + ($2::int * INTERVAL '1 minute') <= $1::timestamptz
  AND EXISTS (
    SELECT 1 FROM clients AS c
    WHERE c.id = b.client_id AND c.telegram_chat_id IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM reviews AS r WHERE r.booking_id = b.id
  )
  ${clientScope.replaceAll("$CLIENT", "$3")}
RETURNING b.id::text AS id
`;

export const completeSql = `
UPDATE bookings AS b
SET status = 'completed', auto_completed_at = $1::timestamptz
WHERE b.status = 'confirmed'
  AND b.ends_at < $1::timestamptz
  AND b.auto_completed_at IS NULL
  ${clientScope.replaceAll("$CLIENT", "$2")}
RETURNING b.id::text AS id
`;

export function releaseSql(kind: "day" | "short" | "review") {
  const column =
    kind === "day" ? "reminder_day_sent_at" : kind === "short" ? "reminder_30m_sent_at" : "review_requested_at";
  return `
UPDATE bookings
SET ${column} = NULL
WHERE id = $1::uuid AND ${column} = $2::timestamptz
`;
}

export const loadVisitSql = `
SELECT b.id::text AS id,
       b.starts_at,
       b.total_duration_min,
       c.telegram_chat_id,
       br.name AS barber_name,
       COALESCE(
         (
           SELECT json_agg(json_build_object('name', bs.name) ORDER BY bs.name)
           FROM booking_services AS bs
           WHERE bs.booking_id = b.id
         ),
         '[]'::json
       ) AS services
FROM bookings AS b
JOIN clients AS c ON c.id = b.client_id
JOIN barbers AS br ON br.id = b.barber_id
WHERE b.id = $1::uuid
`;

export const loadSettingsSql = `
SELECT key, value
FROM settings
WHERE key IN ('reminder_day_minutes', 'reminder_short_minutes', 'review_delay_min')
`;
