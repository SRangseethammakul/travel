/**
 * `$jsonSchema` validators and indexes, transcribed from docs/db/schema.md §3–4.
 * Index names are fixed so tests can assert them.
 */
import type { CreateIndexesOptions, Document, IndexSpecification } from "mongodb";

const id = { bsonType: "string", minLength: 1, maxLength: 100 };
const money = { bsonType: ["int", "long"], minimum: 0 };
const positiveMoney = { bsonType: ["int", "long"], minimum: 1 };
const color = { enum: ["teal", "blue", "orange", "purple", "slate", "gray", "ink"] };
const isoDate = { bsonType: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
const localDateTime = { bsonType: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$" };
const hhmm = { bsonType: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" };
const date = { bsonType: "date" };
const text = (max: number) => ({ bsonType: "string", maxLength: max });
const hop = {
  bsonType: "object",
  additionalProperties: false,
  required: ["mode"],
  properties: {
    mode: { enum: ["walk", "train", "bus", "taxi", "car"] },
    minutes: { bsonType: "int", minimum: 0, maximum: 1440 },
    note: text(500),
  },
};

export interface IndexDef {
  key: IndexSpecification & Document;
  options: CreateIndexesOptions & { name: string };
}

export interface CollectionDef {
  name: string;
  validator: Document;
  indexes: IndexDef[];
}

export const collectionDefs: CollectionDef[] = [
  {
    name: "users",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        additionalProperties: false,
        required: ["_id", "name", "email", "provider", "color", "createdAt"],
        properties: {
          _id: id,
          name: text(100),
          email: text(320),
          avatarUrl: text(2000),
          provider: { enum: ["line", "google"] },
          providerSubject: text(200),
          color,
          sessionVersion: { bsonType: "int", minimum: 0 },
          createdAt: date,
        },
      },
    },
    indexes: [
      {
        key: { provider: 1, providerSubject: 1 },
        options: {
          name: "users_provider_subject",
          unique: true,
          partialFilterExpression: { providerSubject: { $type: "string" } },
        },
      },
    ],
  },
  {
    name: "trips",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        additionalProperties: false,
        required: ["_id", "name", "destination", "startDate", "endDate", "budget", "baseCurrency", "cover", "createdBy", "createdAt", "updatedAt"],
        properties: {
          _id: id,
          name: text(100),
          destination: text(100),
          startDate: isoDate,
          endDate: isoDate,
          budget: { bsonType: ["int", "long", "null"], minimum: 0 },
          baseCurrency: { enum: ["THB"] },
          cover: color,
          legs: {
            bsonType: "array",
            maxItems: 60,
            items: {
              bsonType: "object",
              additionalProperties: false,
              required: ["city", "from", "to"],
              properties: { city: text(100), from: { bsonType: "int", minimum: 1 }, to: { bsonType: "int", minimum: 1 } },
            },
          },
          meetingPoint: text(200),
          createdBy: id,
          createdAt: date,
          updatedAt: date,
        },
      },
    },
    indexes: [],
  },
  {
    name: "members",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        additionalProperties: false,
        required: ["_id", "tripId", "userId", "displayName", "role", "status", "color", "createdAt"],
        properties: {
          _id: id,
          tripId: id,
          userId: { bsonType: ["string", "null"] },
          displayName: text(50),
          role: { enum: ["owner", "editor", "viewer"] },
          status: { enum: ["active", "pending", "removed"] },
          joinedVia: { enum: ["line", "google"] },
          color,
          createdAt: date,
          claimedAt: date,
        },
        // a pending Member is always a real User
        anyOf: [
          { properties: { status: { enum: ["active", "removed"] } } },
          { properties: { status: { enum: ["pending"] }, userId: { bsonType: "string" } } },
        ],
      },
    },
    indexes: [
      {
        key: { userId: 1, tripId: 1 },
        options: { name: "members_user_trip", unique: true, partialFilterExpression: { userId: { $type: "string" } } },
      },
      { key: { tripId: 1 }, options: { name: "members_trip" } },
    ],
  },
  {
    name: "invites",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        additionalProperties: false,
        required: ["_id", "tripId", "token", "expiresAt", "requireApproval", "updatedAt"],
        properties: {
          _id: id,
          tripId: id,
          token: { bsonType: "string", minLength: 22, maxLength: 100 },
          expiresAt: { bsonType: ["date", "null"] },
          requireApproval: { bsonType: "bool" },
          updatedAt: date,
        },
      },
    },
    indexes: [{ key: { token: 1 }, options: { name: "invites_token", unique: true } }],
  },
  {
    name: "documents",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        additionalProperties: false,
        required: ["_id", "tripId", "name", "fileKey", "mime", "size", "uploadedBy", "createdAt"],
        properties: {
          _id: id,
          tripId: id,
          name: text(200),
          fileKey: text(500),
          mime: { enum: ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"] },
          size: { bsonType: ["int", "long"], minimum: 1, maximum: 20971520 },
          uploadedBy: id,
          createdAt: date,
        },
      },
    },
    indexes: [{ key: { tripId: 1 }, options: { name: "documents_trip" } }],
  },
  {
    name: "places",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        additionalProperties: false,
        required: ["_id", "tripId", "name", "type", "city", "area", "tagIds", "note", "createdBy", "createdAt"],
        properties: {
          _id: id,
          tripId: id,
          name: text(200),
          type: { enum: ["sight", "food", "interest", "stay", "transit"] },
          city: text(100),
          area: { bsonType: ["string", "null"], maxLength: 100 },
          tagIds: { bsonType: "array", maxItems: 30, uniqueItems: true, items: id },
          mapUrl: text(2000),
          note: text(2000),
          costPerPerson: money,
          stay: {
            bsonType: "object",
            additionalProperties: false,
            required: ["checkIn", "checkOut"],
            properties: {
              checkIn: text(10),
              checkOut: text(10),
              price: money,
              bookingRef: text(100),
              address: text(300),
              expenseId: id,
            },
          },
          photos: {
            bsonType: "array",
            maxItems: 10,
            items: {
              bsonType: "object",
              additionalProperties: false,
              required: ["_id", "fileKey", "mime", "size", "uploadedBy", "createdAt"],
              properties: {
                _id: id,
                fileKey: text(500),
                mime: { enum: ["image/jpeg", "image/png", "image/heic", "image/webp"] },
                size: { bsonType: ["int", "long"], minimum: 1, maximum: 20971520 },
                uploadedBy: id,
                createdAt: date,
              },
            },
          },
          createdBy: id,
          createdAt: date,
          updatedAt: date,
        },
      },
    },
    indexes: [
      { key: { tripId: 1, city: 1, area: 1 }, options: { name: "places_trip_city_area" } },
      { key: { tagIds: 1 }, options: { name: "places_tagIds" } },
    ],
  },
  {
    name: "tags",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        additionalProperties: false,
        required: ["_id", "ownerId", "name", "group", "createdAt"],
        properties: {
          _id: id,
          ownerId: id,
          name: { bsonType: "string", minLength: 1, maxLength: 50 },
          group: { bsonType: ["string", "null"], maxLength: 50 },
          color,
          createdAt: date,
        },
      },
    },
    indexes: [{ key: { ownerId: 1, name: 1 }, options: { name: "tags_owner_name", unique: true } }],
  },
  {
    name: "planItems",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["_id", "tripId", "kind", "createdAt"],
        oneOf: [
          {
            additionalProperties: false,
            required: ["kind", "day", "time", "placeId", "note", "createdBy"],
            properties: {
              _id: id,
              tripId: id,
              kind: { enum: ["place"] },
              day: { bsonType: "int", minimum: 1, maximum: 366 },
              time: { anyOf: [hhmm, { bsonType: "null" }] },
              placeId: id,
              note: text(2000),
              travelToNext: hop,
              createdBy: id,
              createdAt: date,
            },
          },
          {
            additionalProperties: false,
            required: ["kind", "mode", "fromText", "toText", "departAt", "arriveAt", "docIds", "createdBy"],
            properties: {
              _id: id,
              tripId: id,
              kind: { enum: ["transit"] },
              mode: { enum: ["plane", "train", "bus", "car", "boat", "walk", "other"] },
              fromCode: text(10),
              fromText: text(200),
              toCode: text(10),
              toText: text(200),
              departAt: localDateTime,
              arriveAt: localDateTime,
              durationMinutes: { bsonType: "int", minimum: 0, maximum: 10080 },
              bookingRef: text(100),
              seatInfo: text(200),
              docIds: { bsonType: "array", maxItems: 20, uniqueItems: true, items: id },
              expenseId: id,
              fromPlaceId: id,
              toPlaceId: id,
              travelToNext: hop,
              createdBy: id,
              createdAt: date,
            },
          },
        ],
      },
    },
    indexes: [{ key: { tripId: 1, day: 1, time: 1 }, options: { name: "planItems_trip_day_time" } }],
  },
  {
    name: "expenses",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        additionalProperties: false,
        required: ["_id", "tripId", "title", "category", "payerId", "method", "amount", "currency", "baseAmount", "splitMode", "shares", "date", "createdBy", "createdAt"],
        properties: {
          _id: id,
          tripId: id,
          title: text(200),
          category: { enum: ["stay", "transport", "food", "activity", "other"] },
          payerId: id,
          method: { enum: ["cash", "promptpay", "card", "wallet"] },
          cardLast4: { bsonType: "string", pattern: "^\\d{4}$" },
          cardName: { bsonType: "string", minLength: 1, maxLength: 30 },
          amount: positiveMoney,
          currency: { enum: ["THB"] },
          baseAmount: positiveMoney,
          splitMode: { enum: ["equal", "amount", "shares"] },
          shares: {
            bsonType: "array",
            minItems: 1,
            maxItems: 50,
            items: {
              bsonType: "object",
              additionalProperties: false,
              required: ["memberId", "amount"],
              properties: { memberId: id, amount: money, weight: { bsonType: "int", minimum: 1, maximum: 1000 } },
            },
          },
          slipDocId: id,
          note: text(2000),
          date: isoDate,
          createdBy: id,
          createdAt: date,
          updatedBy: id,
          updatedAt: date,
        },
      },
    },
    indexes: [{ key: { tripId: 1, date: 1, createdAt: 1 }, options: { name: "expenses_trip_date" } }],
  },
  {
    name: "personalExpenses",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        additionalProperties: false,
        required: ["_id", "tripId", "ownerId", "title", "category", "amount", "currency", "baseAmount", "method", "date", "createdAt"],
        properties: {
          _id: id,
          tripId: id,
          ownerId: id,
          title: text(200),
          category: { enum: ["stay", "transport", "food", "activity", "other", "shopping"] },
          amount: positiveMoney,
          currency: { enum: ["THB"] },
          baseAmount: positiveMoney,
          method: { enum: ["cash", "promptpay", "card", "wallet"] },
          cardName: { bsonType: "string", minLength: 1, maxLength: 30 },
          note: text(2000),
          date: isoDate,
          createdAt: date,
          updatedAt: date,
        },
      },
    },
    // Every query filters on tripId + ownerId (private to the owner) and sorts by date.
    indexes: [{ key: { tripId: 1, ownerId: 1, date: 1, createdAt: 1 }, options: { name: "personalExpenses_trip_owner_date" } }],
  },
  {
    name: "settlements",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        additionalProperties: false,
        required: ["_id", "tripId", "fromId", "toId", "amount", "status", "createdAt"],
        properties: {
          _id: id,
          tripId: id,
          fromId: id,
          toId: id,
          amount: positiveMoney,
          status: { enum: ["pending", "sent", "confirmed"] },
          slipDocId: id,
          createdAt: date,
          sentAt: date,
          confirmedAt: date,
        },
        oneOf: [
          { properties: { status: { enum: ["pending"] } } },
          { properties: { status: { enum: ["sent"] } }, required: ["sentAt"] },
          { properties: { status: { enum: ["confirmed"] } }, required: ["sentAt", "confirmedAt"] },
        ],
      },
    },
    indexes: [
      { key: { tripId: 1, createdAt: 1 }, options: { name: "settlements_trip" } },
      // One open (sent) Settlement per payer → receiver: a second concurrent report fails with E11000.
      {
        key: { tripId: 1, fromId: 1, toId: 1 },
        options: { name: "settlements_open_pair", unique: true, partialFilterExpression: { status: "sent" } },
      },
    ],
  },
  {
    name: "checklistItems",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        additionalProperties: false,
        required: ["_id", "tripId", "scope", "text", "category", "done", "fromTemplate", "createdAt"],
        properties: {
          _id: id,
          tripId: id,
          scope: { enum: ["group", "personal"] },
          ownerId: id,
          text: text(300),
          category: text(50),
          assigneeId: id,
          done: { bsonType: "bool" },
          doneBy: id,
          fromTemplate: { bsonType: "bool" },
          createdAt: date,
        },
        oneOf: [
          { properties: { scope: { enum: ["group"] } } },
          { properties: { scope: { enum: ["personal"] } }, required: ["ownerId"] },
        ],
      },
    },
    indexes: [{ key: { tripId: 1, scope: 1, ownerId: 1 }, options: { name: "checklist_trip_scope_owner" } }],
  },
  {
    name: "activities",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        additionalProperties: false,
        required: ["_id", "tripId", "actorId", "type", "refId", "text", "createdAt", "readBy"],
        properties: {
          _id: id,
          tripId: id,
          actorId: id,
          type: { enum: ["expense", "settlement", "plan", "member"] },
          refId: { bsonType: ["string", "null"] },
          text: text(500),
          createdAt: date,
          readBy: { bsonType: "array", maxItems: 100, uniqueItems: true, items: id },
        },
      },
    },
    indexes: [
      { key: { tripId: 1, createdAt: -1 }, options: { name: "activities_trip_created" } },
      { key: { tripId: 1, type: 1, createdAt: -1 }, options: { name: "activities_trip_type_created" } },
    ],
  },
];
