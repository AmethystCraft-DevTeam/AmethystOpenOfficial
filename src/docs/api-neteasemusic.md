# 网易云音乐API

## 简介
网易云音乐API允许你传入歌曲id，并获取音频文件

## 请求方式
- Method: `GET`
- Path: `/pms/song?id=<SongID>`

## 参数
| 参数名 | 类型 | 描述 |
| --- | --- | --- |
| id | number | 歌曲id |

## 响应
```json
{
    "data": [
        {
            "id": 419877223,
            "url": "http://m801.music.126.net/20250925131520/00ac87670a52e47a214936985e36510b/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/28482324397/b649/9892/d5c9/57df4aec0a2305a7ddfe0222ad7df995.mp3?vuutv=CW0OeGApebjV8lo7rnFdzX2wI22aqmv+np7FpM8g91fv3Hpys0ISiytxlvgVNQckJESnBGEWewOgPsDpE2Bj+jeNjk66BA45+wJGHuQT0rU=",
            "br": 320001,
            "size": 12243113,
            "md5": "57df4aec0a2305a7ddfe0222ad7df995",
            "code": 200,
            "expi": 1200,
            "type": "mp3",
            "gain": -8.9987,
            "peak": 1,
            "closedGain": -6,
            "closedPeak": 1,
            "fee": 8,
            "uf": null,
            "payed": 1,
            "flag": 1540102,
            "canExtend": false,
            "freeTrialInfo": null,
            "level": "exhigh",
            "encodeType": "mp3",
            "channelLayout": null,
            "freeTrialPrivilege": {
                "resConsumable": false,
                "userConsumable": false,
                "listenType": null,
                "cannotListenReason": null,
                "playReason": null,
                "freeLimitTagType": null
            },
            "freeTimeTrialPrivilege": {
                "resConsumable": false,
                "userConsumable": false,
                "type": 0,
                "remainTime": 0
            },
            "urlSource": 0,
            "rightSource": 0,
            "podcastCtrp": null,
            "effectTypes": null,
            "time": 306020,
            "message": null,
            "levelConfuse": null,
            "musicId": "8169524559",
            "accompany": null,
            "sr": 44100,
            "auEff": null
        }
    ],
    "code": 200
}
```