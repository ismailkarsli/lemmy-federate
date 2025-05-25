-- Revert uppercased software names
UPDATE
	"Instance" i
	SET
	software = CASE software
		WHEN 'LEMMY' THEN 'lemmy'
		WHEN 'MBIN' THEN 'mbin'
		WHEN 'DCH_BLOG' THEN 'dch_blog'
		ELSE software
	END;
