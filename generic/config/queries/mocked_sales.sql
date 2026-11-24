{{if .plugins.analytics -}}
-- @param max_month_num INT
WITH mock_data (month, month_num, revenue, expenses, customers) AS (
    VALUES
    ('January', 1, 65000, 45000, 850),
    ('February', 2, 72000, 48000, 920),
    ('March', 3, 78000, 52000, 1050),
    ('April', 4, 85000, 55000, 1180),
    ('May', 5, 92000, 58000, 1320),
    ('June', 6, 88000, 54000, 1250),
    ('July', 7, 95000, 60000, 1380),
    ('August', 8, 89000, 56000, 1290),
    ('September', 9, 82000, 53000, 1150),
    ('October', 10, 87000, 55000, 1220),
    ('November', 11, 93000, 59000, 1340),
    ('December', 12, 98000, 62000, 1420)
)

SELECT *
FROM mock_data
WHERE month_num <= :max_month_num
ORDER BY month_num;
{{- end}}
