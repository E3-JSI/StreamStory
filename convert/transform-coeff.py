#!/usr/bin/python

import json
import datetime

DATE_FORMAT =  "%Y-%m-%dT%H:%M:%S.%fZ"
epoch = datetime.datetime.utcfromtimestamp(0)

fin = open('../output/coeff-raw-2months.json', 'r')
fout_gearbox = open('../output/gearbox-2months.csv', 'w')
fout_swivel = open('../output/swivel-2months.csv', 'w')

def unix_time_millis(dt):
    from_epoch = dt - epoch
    return int(from_epoch.total_seconds() * 1000.0)

for line in fin.xreadlines():
    entry = json.loads(line)
    # time interval
    start = entry['start']
    end = entry['end']
    start_ts = unix_time_millis(datetime.datetime.strptime(start, DATE_FORMAT))
    end_ts = unix_time_millis(datetime.datetime.strptime(end, DATE_FORMAT))
    # read the coeff
    gearbox = entry['gearbox']
    swivel = entry['swivel']
    coeff_gearbox = gearbox['value']
    coeff_swivel = swivel['value']
    # write to output files
    fout_gearbox.write(','.join([str(start_ts), str(end_ts), str(coeff_gearbox)]) + '\n')
    fout_swivel.write(','.join([str(start_ts), str(end_ts), str(coeff_swivel)]) + '\n')

fout_gearbox.flush()
fout_swivel.flush()
fout_gearbox.close()
fout_swivel.close()
