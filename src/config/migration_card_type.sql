-- card_type: static behavior types for cards
CREATE TABLE IF NOT EXISTS card_type (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO card_type (name) VALUES ('judge'), ('default') ON CONFLICT DO NOTHING;

-- Add card_type_id FK to card (single new column)
ALTER TABLE card ADD COLUMN IF NOT EXISTS card_type_id INT REFERENCES card_type(id);

-- judge_card: links a card to a judge pool
CREATE TABLE IF NOT EXISTS judge_card (
  id                  SERIAL PRIMARY KEY,
  card_id             INT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  judge_categories_id INT NOT NULL REFERENCES judge_categories(id) ON DELETE CASCADE,
  UNIQUE (card_id, judge_categories_id)
);

-- Migrate existing enkaz card: set type = 'judge' and link to enkaz judge category
UPDATE card
SET card_type_id = (SELECT id FROM card_type WHERE name = 'judge')
WHERE name = 'enkaz' AND card_type_id IS NULL;

INSERT INTO judge_card (card_id, judge_categories_id)
SELECT c.id, jc.id
FROM card c
CROSS JOIN judge_categories jc
WHERE c.name = 'enkaz' AND jc.name = 'enkaz'
ON CONFLICT DO NOTHING;
