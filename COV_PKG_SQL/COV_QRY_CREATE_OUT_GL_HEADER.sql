CREATE COLUMN TABLE "COV_SCH_GL_BRIDGE"."COV_OUT_GL_HEADER"("MESSAGE_GUID" VARCHAR(30), "REF_DOC_NO" VARCHAR(16), "DOC_DATE" DATE, "HEADERTEXT" VARCHAR(25),"COMP_CODE" VARCHAR(4),"PSTNG_DATE" DATE, "TRANS_DATE" DATE, 
"FISC_YEAR" VARCHAR(4), "FIS_PERIOD" VARCHAR(2), "DOC_TYPE" VARCHAR(2),  "REASON_REV" VARCHAR(2), "REF_DOC_NO_LONG" VARCHAR(35), "ACC_PRINCIPLE" VARCHAR(4), "BILL_CATEGORY" VARCHAR(1), "PARTIAL_REV" VARCHAR(1), 
"DOC_STATUS" VARCHAR(1),
PRIMARY KEY ("MESSAGE_GUID", "REF_DOC_NO"));