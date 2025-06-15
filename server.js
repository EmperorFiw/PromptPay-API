const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

function formatPhoneNumber(number) {
  if (number.length === 13) {
    return number;
  }
  if (number.length === 10 && number.startsWith('0')) {
    return '0066' + number.slice(1);
  }
  return number;
}

function crc16xmodem(input) {
  let crc = 0xFFFF;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function generatePromptPayPayload(phoneNumber, amount = 0) {
  if (!(/^\d{10}$/.test(phoneNumber) && phoneNumber.startsWith('0')) && !(/^\d{13}$/.test(phoneNumber))) {
    throw new Error('กรุณากรอกเบอร์โทร 10 หลักขึ้นต้นด้วย 0 หรือเลขบัตรประชาชน 13 หลัก');
  }

  const payloadFormatIndicator = '00' + '02' + '01';
  const pointOfInitiationMethod = '01' + '02' + (amount > 0 ? '12' : '11');
  const AID = '00' + '16' + 'A000000677010111';

  const formattedID = formatPhoneNumber(phoneNumber);
  let tag = '01';
  if (phoneNumber.length === 13) {
    tag = '02';
  }
  const tagLength = String(formattedID.length).padStart(2, '0');
  const tagValue = tag + tagLength + formattedID;

  const merchantAccountInfoValue = AID + tagValue;
  const merchantAccountInfoLength = String(merchantAccountInfoValue.length).padStart(2, '0');
  const merchantAccountInfo = '29' + merchantAccountInfoLength + merchantAccountInfoValue;

  const countryCode = '58' + '02' + 'TH';
  const currencyCode = '53' + '03' + '764';

  let amountField = '';
  if (amount > 0) {
    const amountStr = amount.toFixed(2);
    amountField = '54' + String(amountStr.length).padStart(2, '0') + amountStr;
  }

  const crcPlaceholder = '63' + '04';
  const payloadWithoutCRC = payloadFormatIndicator + pointOfInitiationMethod +
    merchantAccountInfo + countryCode + currencyCode + amountField + crcPlaceholder;

  const crc = crc16xmodem(payloadWithoutCRC);

  return payloadWithoutCRC + crc;
}
app.post('/api/generate', (req, res) => {
  const { phoneNumber, amount } = req.body;
  try {
    const payload = generatePromptPayPayload(phoneNumber, parseFloat(amount || 0));
    res.json({ payload });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`API http://localhost:${port}`);
});