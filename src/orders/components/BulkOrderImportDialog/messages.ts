import { defineMessages } from "react-intl";

export const messages = defineMessages({
  title: {
    id: "yQBnJm",
    defaultMessage: "Bulk order import",
    description: "dialog header",
  },
  description: {
    id: "uRnkBf",
    defaultMessage:
      "Upload a CSV of B2B order lines. Each unique order_ref becomes one confirmed Saleor order. You will receive an email with the per-order result when the import finishes.",
    description: "dialog body description",
  },
  channelLabel: {
    id: "cEoA5A",
    defaultMessage: "Channel",
    description: "preselected channel label",
  },
  fileLabel: {
    id: "VDMaX1",
    defaultMessage: "CSV file",
    description: "file input label",
  },
  chooseCsv: {
    id: "v7KAxy",
    defaultMessage: "Choose CSV",
    description: "file picker button label",
  },
  noFileSelected: {
    id: "9Kq+/h",
    defaultMessage: "No file selected",
    description: "placeholder shown when no file has been chosen",
  },
  fileTooLarge: {
    id: "4VXEsW",
    defaultMessage: "CSV exceeds 10 MB limit",
    description: "error shown when selected file is too large",
  },
  notifyEmailLabel: {
    id: "yWuaxm",
    defaultMessage: "Result email (optional)",
    description: "notification email input label",
  },
  notifyEmailHint: {
    id: "rw3mPU",
    defaultMessage:
      "Where to send the per-order result. Leave blank to use the default ops mailing list.",
    description: "notification email helper text",
  },
  invalidEmail: {
    id: "bOwXha",
    defaultMessage: "Please enter a valid email address",
    description: "email validation error notification",
  },
  submit: {
    id: "K/B+CK",
    defaultMessage: "Start import",
    description: "submit button",
  },
  ackTitle: {
    id: "HkD+ng",
    defaultMessage: "Import accepted",
    description: "success state title",
  },
  close: {
    id: "c4AJJb",
    defaultMessage: "Close",
    description: "close button label in success state",
  },
  batchRef: {
    id: "9Vs399",
    defaultMessage: "Batch ref:",
    description: "batch reference label in success state",
  },
  rowsLabel: {
    id: "d5yffo",
    defaultMessage: "Rows:",
    description: "total rows label in success state",
  },
  ordersQueued: {
    id: "EMDYk6",
    defaultMessage: "Orders queued:",
    description: "orders queued label in success state",
  },
  requestId: {
    id: "5gG17o",
    defaultMessage: "Request id:",
    description: "request id label in success state",
  },
  importFailed: {
    id: "YT9HBt",
    defaultMessage: "Bulk order import failed",
    description: "generic error notification when import throws",
  },
});
