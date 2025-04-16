ALTER TABLE "organizations" DROP CONSTRAINT "organizations_header_image_id_objects_id_fk";
--> statement-breakpoint
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_avatar_image_id_objects_id_fk";
--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_header_image_id_objects_id_fk" FOREIGN KEY ("header_image_id") REFERENCES "storage"."objects"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_avatar_image_id_objects_id_fk" FOREIGN KEY ("avatar_image_id") REFERENCES "storage"."objects"("id") ON DELETE no action ON UPDATE cascade;