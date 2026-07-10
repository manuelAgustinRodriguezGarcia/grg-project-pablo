-- Product list by folder: orderBy [{ updatedAt: desc }, { id: asc }] with where folderId
CREATE INDEX "Product_folderId_updatedAt_id_idx" ON "Product"("folderId", "updatedAt", "id");

-- Price item list by price list: same orderBy pattern with where priceListId
CREATE INDEX "PriceItem_priceListId_updatedAt_id_idx" ON "PriceItem"("priceListId", "updatedAt", "id");

-- Global search / column config: filter FolderColumn by globalFieldKey
CREATE INDEX "FolderColumn_globalFieldKey_idx" ON "FolderColumn"("globalFieldKey");

-- Global search: filter FolderColumn where isGloballySearchable = true
CREATE INDEX "FolderColumn_isGloballySearchable_idx" ON "FolderColumn"("isGloballySearchable");
