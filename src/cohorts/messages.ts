import { defineMessages } from "react-intl";

// User-facing copy for the Cohorts section (TTXY-4705/4707/4713).
export const cohortMessages = defineMessages({
  sectionTitle: {
    defaultMessage: "Cohorts",
    id: "8v88/1",
    description: "cohorts list page title",
  },
  createCohort: {
    defaultMessage: "Create cohort",
    id: "H8NcEt",
    description: "cohorts create button",
  },
  searchLabel: {
    defaultMessage: "Search",
    id: "dgvcmB",
    description: "cohort search field label",
  },
  searchPlaceholder: {
    defaultMessage: "Search by cohort name",
    id: "2HBc4N",
    description: "cohort search field placeholder",
  },
  allTypes: {
    defaultMessage: "All types",
    id: "aVu9Gr",
    description: "cohort type filter, no filter",
  },
  typeStatic: {
    defaultMessage: "Static",
    id: "HDFGW8",
    description: "cohort type static",
  },
  typeDynamic: {
    defaultMessage: "Dynamic",
    id: "T0tlKB",
    description: "cohort type dynamic",
  },
  allStatuses: {
    defaultMessage: "All statuses",
    id: "4ZeNaF",
    description: "cohort status filter, no filter",
  },
  statusActive: {
    defaultMessage: "Active",
    id: "OoK9be",
    description: "cohort status active",
  },
  statusInactive: {
    defaultMessage: "Inactive",
    id: "4b9++e",
    description: "cohort status inactive",
  },
  colName: { defaultMessage: "Name", id: "q4RXId", description: "cohort column name" },
  colType: { defaultMessage: "Type", id: "EMkOt2", description: "cohort column type" },
  colStatus: { defaultMessage: "Status", id: "/chseE", description: "cohort column status" },
  colMembers: { defaultMessage: "Members", id: "zVgWx6", description: "cohort column members" },
  colLastSynced: {
    defaultMessage: "Last synced",
    id: "pWCH+K",
    description: "cohort column last synced",
  },
  colCreated: { defaultMessage: "Created", id: "le6DvG", description: "cohort column created" },
  loading: { defaultMessage: "Loading cohorts…", id: "QadVBN", description: "cohort list loading" },
  empty: {
    defaultMessage: "No cohorts found. Create one to start targeting coupons.",
    id: "eBXGcW",
    description: "cohort list empty state",
  },
  countLabel: {
    defaultMessage: "{count, plural, one {# cohort} other {# cohorts}}",
    id: "k/D/xm",
    description: "cohort total count",
  },
  previous: { defaultMessage: "Previous", id: "FsVajs", description: "pagination previous" },
  next: { defaultMessage: "Next", id: "JkB+5c", description: "pagination next" },
  loadError: {
    defaultMessage: "Failed to load cohorts",
    id: "RFmnnc",
    description: "cohort list load error",
  },

  // create / details
  createTitle: {
    defaultMessage: "Create cohort",
    id: "ES67Zg",
    description: "cohort create page title",
  },
  generalInfo: {
    defaultMessage: "General information",
    id: "eUQwpQ",
    description: "cohort general card title",
  },
  nameLabel: { defaultMessage: "Cohort name", id: "GorVjc", description: "cohort name field" },
  nameHelp: {
    defaultMessage:
      "Also used as the tag written to each member. Cannot be changed once the cohort has members.",
    id: "U7b7A+",
    description: "cohort name helper",
  },
  nameLockedHelp: {
    defaultMessage: "Locked — this name is the tag applied to members.",
    id: "610W5b",
    description: "cohort name locked helper",
  },
  nameRenameHelp: {
    defaultMessage: "Can only be renamed while the cohort has no members.",
    id: "PYEnZw",
    description: "cohort name rename helper",
  },
  descriptionLabel: {
    defaultMessage: "Description",
    id: "nQFeNl",
    description: "cohort description field",
  },
  syncLabel: {
    defaultMessage: "Sync frequency (hours)",
    id: "P4Lu8g",
    description: "cohort sync frequency field",
  },
  syncHelp: {
    defaultMessage: "How often the sync job re-evaluates this cohort.",
    id: "I9QkIo",
    description: "cohort sync frequency helper",
  },
  endDateLabel: { defaultMessage: "End date", id: "hNx2Ld", description: "cohort end date field" },
  endDateHelp: {
    defaultMessage: "Optional. After this date the cohort stops being evaluated.",
    id: "2kMOsk",
    description: "cohort end date helper",
  },
  createdInactive: {
    defaultMessage: "New cohorts are created inactive. Upload members, then activate.",
    id: "f9H0FI",
    description: "cohort create inactive note",
  },
  createError: {
    defaultMessage: "Failed to create cohort",
    id: "uFU3jY",
    description: "cohort create error",
  },
  updateError: {
    defaultMessage: "Failed to update cohort",
    id: "YqYVTM",
    description: "cohort update error",
  },
  loadCohortError: {
    defaultMessage: "Failed to load cohort",
    id: "m/XqXh",
    description: "cohort load error",
  },
  notFound: { defaultMessage: "Cohort not found", id: "heQuLb", description: "cohort not found" },
  activeLabel: { defaultMessage: "Active", id: "k+ZU9P", description: "cohort active toggle" },
  membersSummary: {
    defaultMessage: "{count, plural, one {# member} other {# members}} · type {type}",
    id: "byBGJJ",
    description: "cohort members summary",
  },

  // csv
  csvCardTitle: {
    defaultMessage: "Members — CSV upload",
    id: "ZFVbyH",
    description: "cohort csv card title",
  },
  csvHelp: {
    defaultMessage:
      "Upload a CSV with a phone column (max 500 rows, up to 5 files per cohort). Numbers that don't match an existing customer are reported back — the rest are still imported.",
    id: "ke8nVq",
    description: "cohort csv upload help",
  },
  uploading: { defaultMessage: "Uploading…", id: "lN2qfW", description: "cohort csv uploading" },
  csvError: { defaultMessage: "CSV upload failed", id: "17WvL8", description: "cohort csv error" },
  csvSummary: {
    defaultMessage: "{invalid} of {total} phone numbers were invalid. {valid} imported.",
    id: "5JCVzr",
    description: "cohort csv result summary",
  },
  csvSampleRow: {
    defaultMessage: "Row {row}: {phone} — {reason}",
    id: "oEULRP",
    description: "cohort csv invalid sample row",
  },

  // delete
  deleteCohort: {
    defaultMessage: "Delete cohort",
    id: "Eq6IDm",
    description: "cohort delete button",
  },
  deleteConfirm: {
    defaultMessage:
      "Delete {name}? Its {count, plural, one {# member} other {# members}} will be untagged. Cohorts still referenced by a coupon cannot be deleted.",
    id: "Uqz8iD",
    description: "cohort delete confirmation body",
  },
  deleteError: {
    defaultMessage: "Failed to delete cohort",
    id: "8KUORF",
    description: "cohort delete error",
  },
});
