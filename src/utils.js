function closeBase(base) {
	log.info('Closing base ...');
	
	if (base != null) {
		log.info('Closing ...');
		base.gc();
		base.close();
	}
	
	log.info('Done!');
}

function exit(base) {
	log.info('Closing application ...');
	closeBase(base);
	process.exit(1);
}

module.exports = {
	closeBase: closeBase,
	exit: exit
}