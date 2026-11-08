-- Standard-Zahlungsart ist die Banküberweisung; ShamCash gilt nur für arabische Belege
-- (Auswahl im Server: Kundenstandard → bei Sprache „ar“ ShamCash → Standard).
UPDATE payment_methods SET is_default = false
 WHERE is_default AND kind <> 'bank' AND EXISTS (SELECT 1 FROM payment_methods WHERE kind = 'bank');
UPDATE payment_methods SET is_default = true, is_active = true
 WHERE id = (SELECT id FROM payment_methods WHERE kind = 'bank' ORDER BY is_active DESC, sort LIMIT 1);
