"""Generate the public snapshot from the existing GoatCounter account."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen

OUTPUT = Path(sys.argv[1])
ENDPOINT = 'https://nvn.goatcounter.com/counter/TOTAL.json'


def count(start):
    url = ENDPOINT + ('?' + urlencode({'start': start}) if start else '')
    request = Request(url, headers={'Accept': 'application/json'})
    with urlopen(request, timeout=20) as response:
        value = json.load(response)['count']
    if not re.fullmatch(r"[0-9]+|[0-9]{1,3}(?:[ ,.\u00a0\u202f'’][0-9]{3})+", str(value)):
        raise ValueError('Invalid count from GoatCounter')
    return int(re.sub(r'[^0-9]', '', str(value)))


def main():
    now = datetime.now(timezone.utc)
    day = now.date().isoformat()
    month = day[:7] + '-01'
    with ThreadPoolExecutor(max_workers=3) as pool:
        today, month_total, total = pool.map(count, (day, month, None))
    if datetime.now(timezone.utc).date() != now.date():
        raise RuntimeError('UTC rollover during snapshot')
    snapshot = dict(day=day, fetchedAt=now.isoformat(timespec='seconds'),
                    today=today, month=month_total, total=total)
    temporary = OUTPUT.with_suffix('.tmp')
    temporary.write_text(json.dumps(snapshot, indent=2) + '\n', encoding='utf-8')
    temporary.replace(OUTPUT)


if __name__ == '__main__':
    main()
