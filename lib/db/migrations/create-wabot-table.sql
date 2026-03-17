-- Create WABOT Blast Data table
CREATE TABLE IF NOT EXISTS him_ttdi.wabot_blasts (
    id VARCHAR(255) PRIMARY KEY,
    uid VARCHAR(255),
    receiver VARCHAR(255),
    status VARCHAR(50),
    sent TIMESTAMP,
    delivered TIMESTAMP,
    read TIMESTAMP,
    replied TIMESTAMP,
    failed BOOLEAN,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for searching and filtering performance
CREATE INDEX IF NOT EXISTS idx_wabot_blasts_status ON him_ttdi.wabot_blasts(status);
CREATE INDEX IF NOT EXISTS idx_wabot_blasts_sent ON him_ttdi.wabot_blasts(sent);
CREATE INDEX IF NOT EXISTS idx_wabot_blasts_receiver ON him_ttdi.wabot_blasts(receiver);
