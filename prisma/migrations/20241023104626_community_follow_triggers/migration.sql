-- add new "CommunityFollow" record when a new "Instance" or "Community" is created
CREATE OR REPLACE FUNCTION create_community_follow_on_instance() RETURNS TRIGGER AS $$ BEGIN
INSERT INTO "CommunityFollow" ("communityId", "instanceId", "updatedAt")
SELECT "Community"."id",
	NEW."id",
	now()
FROM "Community" ON CONFLICT DO NOTHING;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION create_community_follow_on_community() RETURNS TRIGGER AS $$ BEGIN
INSERT INTO "CommunityFollow" ("communityId", "instanceId", "updatedAt")
SELECT NEW."id",
	"Instance"."id",
	now()
FROM "Instance" ON CONFLICT DO NOTHING;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER create_community_follow_on_instance
AFTER
INSERT ON "Instance" FOR EACH ROW EXECUTE FUNCTION create_community_follow_on_instance();
CREATE TRIGGER create_community_follow_on_community
AFTER
INSERT ON "Community" FOR EACH ROW EXECUTE FUNCTION create_community_follow_on_community();