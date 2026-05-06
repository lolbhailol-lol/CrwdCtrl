require("dotenv").config();
const fs = require("fs");
const csv = require("csv-parser");
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// ⚙️ SAFE SETTINGS (don’t go too aggressive)
const BATCH_SIZE = 40;   // safer than 90
const DELAY = 4000;      // 4 sec delay

const emails = [];

fs.createReadStream("test.users.csv")
  .pipe(csv())
  .on("data", (row) => {
    if (row.email) {
      emails.push(row.email.trim().toLowerCase());
    }
  })
  .on("end", async () => {
    console.log(`📊 Loaded ${emails.length} emails`);

    if (emails.length === 0) {
      console.log("❌ No emails found");
      return;
    }

    // 🔥 remove duplicates (important)
    const uniqueEmails = [...new Set(emails)];
    console.log(`🧹 Unique emails: ${uniqueEmails.length}`);

    let batchNumber = 1;

    for (let i = 0; i < uniqueEmails.length; i += BATCH_SIZE) {
      const batch = uniqueEmails.slice(i, i + BATCH_SIZE);

      console.log(`🚀 Sending batch ${batchNumber} (${batch.length} emails)`);

      try {
        const response = await resend.emails.send({
          from: "CrwdCtrl <onboarding@crwdctrl.in>", // must be verified
          to: batch,
          subject: "Were you at the Fest?",
          html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="preload" as="image" href="images/a3e956e012a0d1f45d6184c6048b28c9.png"><link rel="preload" as="image" href="images/044da6c7cfaa221d4ae12e3fbfe80476.jpg"><link rel="preload" as="image" href="images/1d17664e1f2eb18bc80f0a9d852efb98.jpg"><link rel="preload" as="image" href="images/fe94528e16a8f06edbebd99ea261e4e0.png"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="format-detection" content="telephone=no, date=no, address=no, email=no"><meta name="x-apple-disable-message-reformatting"><meta name="keywords" content="DAHIZ9h_BGE, BAFy6Q4blAI"><style>body{margin:0;padding:0}table{mso-table-lspace:0;mso-table-rspace:0}p,span,h1,h2,h3,h4,h5,h6{margin:0;padding:0}p{line-height:inherit}a[x-apple-data-detectors]{color:inherit!important;text-decoration:inherit!important}#MessageViewBody a{color:inherit;text-decoration:none}img+div{display:none}</style><!--[if mso]><div>
                <noscript>
                  <xml>
                    <w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word">
                      <w:DontUseAdvancedTypographyReadingMail/>
                    </w:WordDocument>
                    <o:OfficeDocumentSettings>
                      <o:AllowPNG/>
                      <o:PixelsPerInch>96</o:PixelsPerInch>
                    </o:OfficeDocumentSettings>
                  </xml>
                </noscript></div><![endif]--><style>@media(max-width:550px){.ers-fs-187{font-size:17.4px!important}.ers-fs-213{font-size:18.6px!important}.ers-fs-240{font-size:20px!important}}</style></head><body style="width:100%;-webkit-text-size-adjust:100%;text-size-adjust:100%;background-color:#f0f1f5;margin:0;padding:0"><table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f0f1f5" style="background-color:#f0f1f5"><tbody><tr><td style="background-color:#f0f1f5"><!--[if mso]><center>
                    <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
                      <tbody>
                        <tr>
                          <td><![endif]--><table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;min-height:600px;margin:0 auto;background-color:#020b0a"><tbody><tr><td style="vertical-align:top"></td></tr><tr><td style="vertical-align:top;padding:0px
           0px
           0px
           0px"><table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody><tr><td style="padding:24px 0 24px 0;vertical-align:top"><table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="color:#000;font-style:normal;font-weight:normal;font-size:16px;line-height:1.4;letter-spacing:0;text-align:left;direction:ltr;border-collapse:collapse;font-family:Arial, Helvetica, sans-serif;white-space:normal;word-wrap:break-word;word-break:break-word"><tbody><tr><td style="padding:0px 24px 16px"><table cellpadding="0" cellspacing="0" border="0" style="width:100%"><tbody><tr><td align="left"><table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:111px"><tbody><tr><td style="width:100%;padding:24 0"><img src="https://b9kqebckzmreaq9waa54apdm8ecy3yrh3uhmwux93pi.canva-cdn.email/a3e956e012a0d1f45d6184c6048b28c9.png" width="111" height="60" style="display:block;width:100%;height:auto;max-width:100%"></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td dir="ltr" style="color:#22ded7;font-size:16px;text-align:right;padding:0px 24px 16px;line-height:0.5;mso-line-height-alt:16px"><a href="https://www.crwdctrl.in" target="_blank" rel="noopener nofollow" ses:no-track="" style="color:#22ded7;text-decoration:inherit"><span style="text-decoration:underline;white-space:pre-wrap">www.crwdctrl.in</span></a><span style="white-space:pre-wrap"><br></span></td></tr><tr><td style="padding:0px 0px 16px"><table cellpadding="0" cellspacing="0" border="0" style="width:100%"><tbody><tr><td align="center"><table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px"><tbody><tr><td style="width:100%;padding:0"><img src="https://b9kqebckzmreaq9waa54apdm8ecy3yrh3uhmwux93pi.canva-cdn.email/044da6c7cfaa221d4ae12e3fbfe80476.jpg" width="600" height="535" style="display:block;width:100%;height:auto;max-width:100%"></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td dir="ltr" class="ers-fs-213" style="color:#ffffff;font-size:21.3px;letter-spacing:0.068em;font-family:Montserrat, Arial, Helvetica, sans-serif;white-space:pre-wrap;text-align:center;padding:0px 24px 16px;line-height:1.2;mso-line-height-alt:26px">Don’t miss the next one!<br></td></tr><tr><td style="padding:0px 24px 16px"><table cellpadding="0" cellspacing="0" border="0" style="width:100%"><tbody><tr><td align="center"><table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:251px"><tbody><tr><td style="width:100%;padding:24 0"><table cellpadding="0" cellspacing="0" style="width:100%;border-spacing:0;border-collapse:separate"><tbody><tr><td valign="middle" height="55" style="height:55px;vertical-align:middle;box-sizing:border-box;background-color:#20aea9;border-top-left-radius:25.922922554561147px;border-top-right-radius:25.922922554561147px;border-bottom-left-radius:25.922922554561147px;border-bottom-right-radius:25.922922554561147px"><a href="https://chat.whatsapp.com/DD3JZyrasKxGTTX1wV9E7J" ses:no-track="" target="_blank" rel="noopener" style="text-decoration:none;display:block"><table cellpadding="0" cellspacing="0" style="width:100%;height:100%;border-spacing:0;border-collapse:collapse"><tbody><tr><td style="color:#ffffff;font-size:20px;font-weight:bold;font-family:Montserrat, Arial, Helvetica, sans-serif;font-style:normal;text-decoration:none;direction:ltr;text-align:center;line-height:1.4em;letter-spacing:0em;vertical-align:middle;box-sizing:border-box"><span style="color:#ffffff;mso-style-textfill-type:solid;mso-style-textfill-fill-color:#ffffff">JOIN NOW
</span></td></tr></tbody></table></a></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="padding:0px 0px 16px"><table cellpadding="0" cellspacing="0" border="0" style="width:100%"><tbody><tr><td align="center"><table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px"><tbody><tr><td style="width:100%;padding:0"><img src="https://b9kqebckzmreaq9waa54apdm8ecy3yrh3uhmwux93pi.canva-cdn.email/1d17664e1f2eb18bc80f0a9d852efb98.jpg" width="600" height="535" style="display:block;width:100%;height:auto;max-width:100%"></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="padding:0px 24px 16px"><table cellpadding="0" cellspacing="0" border="0" style="width:100%"><tbody><tr><td align="center"><table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:230px"><tbody><tr><td style="width:100%;padding:24 0"><table cellpadding="0" cellspacing="0" style="width:100%;border-spacing:0;border-collapse:separate"><tbody><tr><td valign="middle" height="60" style="height:60px;vertical-align:middle;box-sizing:border-box;background-color:#20aea9;border-top-left-radius:25.891459786494657px;border-top-right-radius:25.891459786494657px;border-bottom-left-radius:25.891459786494657px;border-bottom-right-radius:25.891459786494657px"><a href="https://www.instagram.com/crwdctrl.in" ses:no-track="" target="_blank" rel="noopener" style="text-decoration:none;display:block"><table cellpadding="0" cellspacing="0" style="width:100%;height:100%;border-spacing:0;border-collapse:collapse"><tbody><tr><td style="color:#ffffff;font-size:20px;font-weight:bold;font-family:Montserrat, Arial, Helvetica, sans-serif;font-style:normal;text-decoration:none;direction:ltr;text-align:center;line-height:1.4em;letter-spacing:0em;vertical-align:middle;box-sizing:border-box"><span style="color:#ffffff;mso-style-textfill-type:solid;mso-style-textfill-fill-color:#ffffff">SEE IT HERE
</span></td></tr></tbody></table></a></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td dir="ltr" class="ers-fs-240" style="color:#ffffff;font-size:24px;letter-spacing:0.052em;font-family:Anton, Arial, Helvetica, sans-serif;white-space:pre-wrap;text-align:center;padding:0px 24px 16px;line-height:0.5;mso-line-height-alt:24px;text-decoration:none">&nbsp;</td></tr><tr><td dir="ltr" class="ers-fs-240" style="color:#ffffff;font-size:24px;letter-spacing:0.052em;font-family:Anton, Arial, Helvetica, sans-serif;white-space:pre-wrap;text-align:center;padding:0px 24px 16px;line-height:0.5;mso-line-height-alt:24px;text-decoration:none">&nbsp;</td></tr><tr><td dir="ltr" class="ers-fs-240" style="color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.052em;font-family:Montserrat, Arial, Helvetica, sans-serif;white-space:pre-wrap;text-align:center;padding:0px 24px 16px;line-height:0.5;mso-line-height-alt:24px">ALL AT ONE PLACE<br></td></tr><tr><td style="padding:0px 24px 16px"><table cellpadding="0" cellspacing="0" border="0" style="width:100%"><tbody><tr><td align="center"><table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:126px"><tbody><tr><td style="width:100%;padding:24 0"><img src="https://b9kqebckzmreaq9waa54apdm8ecy3yrh3uhmwux93pi.canva-cdn.email/fe94528e16a8f06edbebd99ea261e4e0.png" width="126" height="65" style="display:block;width:100%;height:auto;max-width:100%"></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td dir="ltr" class="ers-fs-187" style="color:#f3f3f3;font-size:18.7px;font-family:Anton, Arial, Helvetica, sans-serif;text-align:center;padding:0px 24px;line-height:0.5;mso-line-height-alt:19px"><a href="https://www.crwdctrl.in" target="_blank" rel="noopener nofollow" ses:no-track="" style="color:#f3f3f3;text-decoration:inherit"><span style="text-decoration:underline;white-space:pre-wrap">crwdctrl.in</span></a><span style="white-space:pre-wrap"><br></span></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td height="100%" style="height:100%;font-size:0;line-height:0" aria-hidden="true">&nbsp;</td></tr></tbody></table><!--[if mso]></td>
                </tr>
              </tbody>
            </table>
          </center><![endif]--></td></tr></tbody></table><script>(function(){function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'9f4e4d951daf88ec',t:'MTc3NzYzMzQ0Mg=='};var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();</script></body></html>` // paste your same HTML here
        });

        console.log(`✅ Batch ${batchNumber} sent:`, response.id);
      } catch (err) {
        console.error(`❌ Batch ${batchNumber} failed:`, err.message);
      }

      batchNumber++;

      // ⏳ Delay to avoid rate limit / spam detection
      await new Promise((res) => setTimeout(res, DELAY));
    }

    console.log("🎉 All emails processed!");
  });