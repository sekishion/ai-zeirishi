import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = 'gYbd2de6jdYB6FhHVkML3kivbYXxIJX0K0iEoKUEJ5ksY6jme14TUQ63SqMHbdW04LHmWqle/YOM8GTYYmU420jgomFA61sPL6jNWFxWu4K94AqhohAAUIMsSur654EVvERrjDoceMt207JsphgglQdB04t89/1O/w1cDnyilFU=';

async function main() {
  // Step 1: 既存リッチメニュー一覧を取得
  console.log('1. 既存リッチメニュー取得中...');
  const listRes = await fetch('https://api.line.me/v2/bot/richmenu/list', {
    headers: { 'Authorization': `Bearer ${TOKEN}` },
  });
  const listData = await listRes.json();
  console.log(`   既存メニュー: ${listData.richmenus?.length || 0}件`);

  // Step 2: 新しいリッチメニューを作成（6ボタン 2x3）
  console.log('2. 新リッチメニュー作成中...');
  const menuBody = {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: 'AI経理部長 メニュー（ライト版）',
    chatBarText: 'メニュー',
    areas: [
      // Row 1
      { bounds: { x: 0, y: 0, width: 833, height: 843 }, action: { type: 'message', text: 'レシート' } },
      { bounds: { x: 833, y: 0, width: 834, height: 843 }, action: { type: 'message', text: '請求書を作りたい' } },
      { bounds: { x: 1667, y: 0, width: 833, height: 843 }, action: { type: 'message', text: '入金を記録したい' } },
      // Row 2
      { bounds: { x: 0, y: 843, width: 833, height: 843 }, action: { type: 'message', text: '今月のまとめ' } },
      { bounds: { x: 833, y: 843, width: 834, height: 843 }, action: { type: 'message', text: '仕訳履歴' } },
      { bounds: { x: 1667, y: 843, width: 833, height: 843 }, action: { type: 'message', text: '経理に質問したい' } },
    ],
  };

  const createRes = await fetch('https://api.line.me/v2/bot/richmenu', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(menuBody),
  });
  const createData = await createRes.json();

  if (!createData.richMenuId) {
    console.error('   作成失敗:', createData);
    return;
  }
  const newMenuId = createData.richMenuId;
  console.log(`   新メニューID: ${newMenuId}`);

  // Step 3: 画像をアップロード
  console.log('3. 画像アップロード中...');
  const imgPath = path.join(__dirname, 'richmenu6_light.png');
  const imgBuffer = fs.readFileSync(imgPath);

  const uploadRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${newMenuId}/content`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'image/png',
    },
    body: imgBuffer,
  });

  if (!uploadRes.ok) {
    console.error('   アップロード失敗:', await uploadRes.text());
    return;
  }
  console.log('   画像アップロード完了');

  // Step 4: デフォルトに設定
  console.log('4. デフォルトメニューに設定中...');
  const defaultRes = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${newMenuId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}` },
  });

  if (!defaultRes.ok) {
    console.error('   デフォルト設定失敗:', await defaultRes.text());
    return;
  }
  console.log('   デフォルト設定完了');

  // Step 5: 古いリッチメニューを削除
  if (listData.richmenus?.length > 0) {
    console.log('5. 古いメニュー削除中...');
    for (const old of listData.richmenus) {
      if (old.richMenuId !== newMenuId) {
        await fetch(`https://api.line.me/v2/bot/richmenu/${old.richMenuId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${TOKEN}` },
        });
        console.log(`   削除: ${old.richMenuId} (${old.name})`);
      }
    }
  }

  console.log('\n完了! ライト版リッチメニューが反映されました。');
}

main().catch(console.error);
