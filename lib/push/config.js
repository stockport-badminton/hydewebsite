// Public half of the VAPID key pair — safe to commit; the browser needs it to
// subscribe. The private half is the VAPID_PRIVATE_KEY env var (GitHub secret →
// .env at deploy). Rotating the pair invalidates every existing subscription.
module.exports = {
  vapidPublicKey: 'BEYraZvIz0gSCOu-LzTL0qQSb2IkMsZ4WXSpRn2O_KUvsyVw7hY8xCGiQRy05GsDLwytYEjLK_Ew9Dlz-QLXEos',
  vapidSubject: 'https://www.hydebadminton.co.uk',
};
