-- MySQL dump 10.13  Distrib 5.5.47, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: StreamStoryDev
-- ------------------------------------------------------
-- Server version	5.5.47-0ubuntu0.14.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `config`
--

DROP TABLE IF EXISTS `config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `config` (
  `property` varchar(100) NOT NULL,
  `value` varchar(100) NOT NULL,
  PRIMARY KEY (`property`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `config`
--

LOCK TABLES `config` WRITE;
/*!40000 ALTER TABLE `config` DISABLE KEYS */;
INSERT INTO `config` VALUES ('calc_coeff','false'),('deviation_extreme','5'),('deviation_extreme_lambda','3.888'),('deviation_major','4'),('deviation_major_lambda','0.648'),('deviation_minor','2'),('deviation_minor_lambda','0.05'),('deviation_significant','3'),('deviation_significant_lambda','0.1');
/*!40000 ALTER TABLE `config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `model`
--

DROP TABLE IF EXISTS `model`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `model` (
  `mid` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `username` varchar(100) NOT NULL,
  `model_file` varchar(255) NOT NULL,
  `dataset` varchar(255) NOT NULL,
  `is_realtime` tinyint(1) NOT NULL DEFAULT '0',
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_public` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`mid`),
  UNIQUE KEY `model_file` (`model_file`),
  KEY `username` (`username`),
  CONSTRAINT `model_ibfk_1` FOREIGN KEY (`username`) REFERENCES `user` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `model`
--

LOCK TABLES `model` WRITE;
/*!40000 ALTER TABLE `model` DISABLE KEYS */;
INSERT INTO `model` VALUES (1,'GEO','','luka@lstopar.si','/mnt/raidM2T/project-data/StreamStory-hella3/offline-db/luka@lstopar.si/1463997437521/StreamStory.bin','export_loc_luka-out-new.csv',0,'2016-05-23 09:58:11',0),(2,'Weather','','luka@lstopar.si','/mnt/raidM2T/project-data/StreamStory-hella3/offline-db/luka@lstopar.si/1463997706489/StreamStory.bin','rainfall-england.csv',0,'2016-05-23 10:01:48',0),(3,'BB','','luka@lstopar.si','/mnt/raidM2T/project-data/StreamStory-hella3/offline-db/luka@lstopar.si/1463998064118/StreamStory.bin','rpm_logs_bb_jul.csv',0,'2016-05-23 10:09:19',0),(4,'Test MhWirth','','luka@lstopar.si','/mnt/raidM2T/project-data/StreamStory-hella3/models/1464257875931.bin','mhwirth-10s-2016-02-02.csv',1,'2016-05-26 10:17:55',0),(5,'AquaSmart','','luka@lstopar.si','/mnt/raidM2T/project-data/StreamStory-hella3/offline-db/luka@lstopar.si/1464338985621/StreamStory.bin','ss_ardgSamplingCleanFixed.csv',0,'2016-05-27 09:31:16',0);
/*!40000 ALTER TABLE `model` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `offline_model`
--

DROP TABLE IF EXISTS `offline_model`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `offline_model` (
  `mid` int(11) NOT NULL,
  `base_dir` varchar(255) NOT NULL,
  PRIMARY KEY (`mid`),
  CONSTRAINT `offline_model_ibfk_1` FOREIGN KEY (`mid`) REFERENCES `model` (`mid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `offline_model`
--

LOCK TABLES `offline_model` WRITE;
/*!40000 ALTER TABLE `offline_model` DISABLE KEYS */;
INSERT INTO `offline_model` VALUES (1,'/mnt/raidM2T/project-data/StreamStory-hella3/offline-db/luka@lstopar.si/1463997437521'),(2,'/mnt/raidM2T/project-data/StreamStory-hella3/offline-db/luka@lstopar.si/1463997706489'),(3,'/mnt/raidM2T/project-data/StreamStory-hella3/offline-db/luka@lstopar.si/1463998064118'),(5,'/mnt/raidM2T/project-data/StreamStory-hella3/offline-db/luka@lstopar.si/1464338985621');
/*!40000 ALTER TABLE `offline_model` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `online_model`
--

DROP TABLE IF EXISTS `online_model`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `online_model` (
  `mid` int(11) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`mid`),
  CONSTRAINT `online_model_ibfk_1` FOREIGN KEY (`mid`) REFERENCES `model` (`mid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `online_model`
--

LOCK TABLES `online_model` WRITE;
/*!40000 ALTER TABLE `online_model` DISABLE KEYS */;
INSERT INTO `online_model` VALUES (4,1);
/*!40000 ALTER TABLE `online_model` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `state_properties`
--

DROP TABLE IF EXISTS `state_properties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `state_properties` (
  `mid` int(11) NOT NULL,
  `sid` int(11) NOT NULL,
  `eventId` varchar(255) DEFAULT NULL,
  `description` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`mid`,`sid`),
  CONSTRAINT `state_properties_ibfk_1` FOREIGN KEY (`mid`) REFERENCES `model` (`mid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `state_properties`
--

LOCK TABLES `state_properties` WRITE;
/*!40000 ALTER TABLE `state_properties` DISABLE KEYS */;
/*!40000 ALTER TABLE `state_properties` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user` (
  `email` varchar(100) NOT NULL,
  `passwd` varchar(128) NOT NULL,
  `theme` enum('dark','light') NOT NULL DEFAULT 'dark',
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user`
--

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
INSERT INTO `user` VALUES ('luka@lstopar.si','ee79976c9380d5e337fc1c095ece8c8f22f91f306ceeb161fa51fecede2c4ba1','dark');
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2016-05-27 14:38:49
