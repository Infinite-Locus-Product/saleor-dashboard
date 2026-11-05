import { GiftCardBatchSummary } from "../GiftCardBatches/GiftCardBatchSummary";
import GiftCardListSearchAndFilters from "./GiftCardListSearchAndFilters";
import { GiftCardsListDatagrid } from "./GiftCardsListDatagrid";
import GiftCardsListHeader from "./GiftCardsListHeader";

const GiftCardsListPage = () => (
  <>
    <GiftCardsListHeader />
    <GiftCardBatchSummary />
    <GiftCardListSearchAndFilters />
    <GiftCardsListDatagrid />
  </>
);

export default GiftCardsListPage;
