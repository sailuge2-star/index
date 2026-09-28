# 로그라이크 캐릭터 이미지 교체 방법

게임의 주인공/적/보스 5종을 실제 PNG 또는 JPG 이미지로 교체할 수 있도록 분리했습니다.

## 파일 위치

`assets/roguelike/characters/`

| 파일 | 게임 캐릭터 | 기본 표시 크기 |
|---|---|---:|
| `player.png` | 뽀린걸(주인공) | 64×64 |
| `enemy.png` | 일반 적 | 64×64 |
| `bat.png` | 박쥐 | 64×64 |
| `elite.png` | 엘리트 | 67.2×67.2 |
| `boss.png` | 보스 | 99.2×99.2 |

## 교체 방법

1. 원하는 PNG/JPG 이미지를 준비합니다.
2. 기존 파일을 같은 이름으로 덮어씁니다.
3. PNG라면 바로 적용됩니다.
4. JPG를 사용할 경우 `character-assets.js`에서 해당 파일의 확장자를 `.jpg`로 바꿉니다.

예:

```js
window.BBORINGIRL_CHARACTER_ASSETS = {
  player: 'assets/roguelike/characters/player.jpg',
  enemy:  'assets/roguelike/characters/enemy.png',
  bat:    'assets/roguelike/characters/bat.png',
  elite:  'assets/roguelike/characters/elite.jpg',
  boss:   'assets/roguelike/characters/boss.png'
};
```

## 권장 이미지

- 정사각형 이미지 권장: 64×64 / 128×128 / 256×256 등
- 투명 배경이 필요하면 PNG 사용 권장
- 원본 이미지가 크더라도 게임에서 캐릭터별 표시 크기에 맞춰 자동 조정됩니다.
- 이미지 파일을 바꾸기만 하면 게임 코드를 수정할 필요가 없습니다(확장자가 PNG인 경우).

## 기존 게임 동작

이미지가 없거나 로딩되지 않는 경우 기존 코드에서 생성하던 기본 도형 텍스처를 fallback으로 사용하도록 되어 있습니다.
