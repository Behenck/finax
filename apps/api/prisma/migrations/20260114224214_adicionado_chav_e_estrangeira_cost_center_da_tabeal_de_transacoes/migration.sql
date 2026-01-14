-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
