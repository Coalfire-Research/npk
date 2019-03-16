angular
	.module('app')
	.service('pricingSvc', [function() {
		return {
			hashTypes: {"MD5":0,"md5($pass.$salt)":10,"md5($salt.$pass)":20,"md5(utf16le($pass).$salt)":30,"md5($salt.utf16le($pass))":40,"HMAC-MD5 (key = $pass)":50,"HMAC-MD5 (key = $salt)":60,"SHA1":100,"sha1($pass.$salt)":110,"sha1($salt.$pass)":120,"sha1(utf16le($pass).$salt)":130,"sha1($salt.utf16le($pass))":140,"HMAC-SHA1 (key = $pass)":150,"HMAC-SHA1 (key = $salt)":160,"MySQL323":200,"MySQL4.1/MySQL5":300,"phpass, WordPress (MD5),":400,"phpass, phpBB3 (MD5)":400,"md5crypt, MD5 (Unix), Cisco-IOS $1$ (MD5)":500,"Juniper IVE":501,"BLAKE2b-512":600,"MD4":900,"NTLM":1000,"Domain Cached Credentials (DCC), MS Cache":1100,"SHA-224":1300,"SHA-256":1400,"sha256($pass.$salt)":1410,"sha256($salt.$pass)":1420,"sha256(utf16le($pass).$salt)":1430,"sha256($salt.utf16le($pass))":1440,"HMAC-SHA256 (key = $pass)":1450,"HMAC-SHA256 (key = $salt)":1460,"descrypt, DES (Unix), Traditional DES":1500,"Apache $apr1$ MD5, md5apr1, MD5 (APR)":1600,"SHA-512":1700,"sha512($pass.$salt)":1710,"sha512($salt.$pass)":1720,"sha512(utf16le($pass).$salt)":1730,"sha512($salt.utf16le($pass))":1740,"HMAC-SHA512 (key = $pass)":1750,"HMAC-SHA512 (key = $salt)":1760,"sha512crypt $6$, SHA512 (Unix)":1800,"Domain Cached Credentials 2 (DCC2), MS Cache 2":2100,"Cisco-PIX MD5":2400,"Cisco-ASA MD5":2410,"WPA/WPA2":2500,"WPA/WPA2 PMK":2501,"md5(md5($pass))":2600,"LM":3000,"Oracle H: Type (Oracle 7+), DES(Oracle)":3100,"bcrypt $2*$, Blowfish (Unix)":3200,"md5($salt.md5($pass))":3710,"md5($salt.$pass.$salt)":3800,"md5(md5($pass).md5($salt))":3910,"md5($salt.md5($salt.$pass))":4010,"md5($salt.md5($pass.$salt))":4110,"md5(strtoupper(md5($pass)))":4300,"md5(sha1($pass))":4400,"sha1(sha1($pass))":4500,"sha1($salt.sha1($pass))":4520,"sha1(md5($pass))":4700,"iSCSI CHAP authentication, MD5(CHAP)":4800,"sha1($salt.$pass.$salt)":4900,"SHA-3 (Keccak)":5000,"Half MD5":5100,"Password Safe v3":5200,"IKE-PSK MD5":5300,"IKE-PSK SHA1":5400,"NetNTLMv1 / NetNTLMv1+ESS":5500,"NetNTLMv2":5600,"Cisco-IOS type 4 (SHA256)":5700,"Samsung Android Password/PIN":5800,"RIPEMD-160":6000,"Whirlpool":6100,"TrueCrypt 5.0+ PBKDF2-HMAC-RIPEMD160 + AES":6211,"TrueCrypt 5.0+ PBKDF2-HMAC-RIPEMD160 + Serpent":6211,"TrueCrypt 5.0+ PBKDF2-HMAC-RIPEMD160 + Twofish":6211,"TrueCrypt 5.0+ PBKDF2-HMAC-RIPEMD160 + AES-Twofish":6212,"TrueCrypt 5.0+ PBKDF2-HMAC-RIPEMD160 + AES-Twofish-Serpent":6213,"TrueCrypt 5.0+ PBKDF2-HMAC-RIPEMD160 + Serpent-AES":6212,"TrueCrypt 5.0+ PBKDF2-HMAC-RIPEMD160 + Serpent-Twofish-AES":6213,"TrueCrypt 5.0+ PBKDF2-HMAC-RIPEMD160 + Twofish-Serpent":6212,"TrueCrypt 5.0+ SHA512 + AES":6221,"TrueCrypt 5.0+ SHA512 + Serpent":6221,"TrueCrypt 5.0+ SHA512 + Twofish":6221,"TrueCrypt 5.0+ SHA512 + AES-Twofish":6222,"TrueCrypt 5.0+ SHA512 + AES-Twofish-Serpent":6223,"TrueCrypt 5.0+ SHA512 + Serpent-AES":6222,"TrueCrypt 5.0+ SHA512 + Serpent-Twofish-AES":6223,"TrueCrypt 5.0+ SHA512 + Twofish-Serpent":6222,"TrueCrypt 5.0+ Whirlpool + AES":6231,"TrueCrypt 5.0+ Whirlpool + Serpent":6231,"TrueCrypt 5.0+ Whirlpool + Twofish":6231,"TrueCrypt 5.0+ Whirlpool + AES-Twofish":6232,"TrueCrypt 5.0+ Whirlpool + AES-Twofish-Serpent":6233,"TrueCrypt 5.0+ Whirlpool + Serpent-AES":6232,"TrueCrypt 5.0+ Whirlpool + Serpent-Twofish-AES":6233,"TrueCrypt 5.0+ Whirlpool + Twofish-Serpent":6232,"TrueCrypt 5.0+ PBKDF2-HMAC-RIPEMD160 + AES + boot":6241,"TrueCrypt 5.0+ PBKDF2-HMAC-RIPEMD160 + Serpent + boot":6241,"TrueCrypt 5.0+ PBKDF2-HMAC-RIPEMD160 + Twofish + boot":6241,"TrueCrypt 5.0+ PBKDF2-HMAC-RIPEMD160 + AES-Twofish + boot":6242,"TrueCrypt 5.0+ PBKDF2-HMAC-RIPEMD160 + AES-Twofish-Serpent + boot":6243,"TrueCrypt 5.0+ PBKDF2-HMAC-RIPEMD160 + Serpent-AES + boot":6242,"TrueCrypt 5.0+ PBKDF2-HMAC-RIPEMD160 + Serpent-Twofish-AES + boot":6243,"TrueCrypt 5.0+ PBKDF2-HMAC-RIPEMD160 + Twofish-Serpent + boot":6242,"AIX {smd5}":6300,"AIX {ssha256}":6400,"AIX {ssha512}":6500,"1Password, agilekeychain":6600,"AIX {ssha1}":6700,"LastPass + LastPass sniffed":6800,"GOST R 34.11-94":6900,"FortiGate (FortiOS)":7000,"OSX v10.8+ (PBKDF2-SHA512)":7100,"GRUB 2":7200,"IPMI2 RAKP HMAC-SHA1":7300,"sha256crypt $5$, SHA256 (Unix)":7400,"Kerberos 5 AS-REQ Pre-Auth etype 23":7500,"SAP CODVN B (BCODE)":7700,"SAP CODVN F/G (PASSCODE)":7800,"Drupal7":7900,"Sybase ASE":8000,"Citrix NetScaler":8100,"1Password, cloudkeychain":8200,"DNSSEC (NSEC3)":8300,"WBB3 (Woltlab Burning Board)":8400,"RACF":8500,"Lotus Notes/Domino 5":8600,"Lotus Notes/Domino 6":8700,"Android FDE <= 4.3":8800,"scrypt":8900,"Password Safe v2":9000,"Lotus Notes/Domino 8":9100,"Cisco-IOS $8$ (PBKDF2-SHA256)":9200,"Cisco-IOS $9$ (scrypt)":9300,"MS Office 2007":9400,"MS Office 2010":9500,"MS Office 2013":9600,"MS Office ⇐ 2003 MD5 + RC4, oldoffice$0, oldoffice$1":9700,"MS Office ⇐ 2003 SHA1 + RC4, oldoffice$3, oldoffice$4":9800,"Radmin2":9900,"Django (PBKDF2-SHA256)":10000,"SipHash":10100,"CRAM-MD5":10200,"SAP CODVN H (PWDSALTEDHASH) iSSHA-1":10300,"PDF 1.1 - 1.3 (Acrobat 2 - 4)":10400,"PDF 1.4 - 1.6 (Acrobat 5 - 8)":10500,"PDF 1.7 Level 3 (Acrobat 9)":10600,"PDF 1.7 Level 8 (Acrobat 10 - 11)":10700,"SHA-384":10800,"PBKDF2-HMAC-SHA256":10900,"PrestaShop":11000,"PostgreSQL CRAM (MD5)":11100,"MySQL CRAM (SHA1)":11200,"Bitcoin/Litecoin wallet.dat":11300,"SIP digest authentication (MD5)":11400,"CRC32":11500,"7-Zip":11600,"GOST R 34.11-2012 (Streebog) 256-bit":11700,"GOST R 34.11-2012 (Streebog) 512-bit":11800,"PBKDF2-HMAC-MD5":11900,"PBKDF2-HMAC-SHA1":12000,"PBKDF2-HMAC-SHA512":12100,"eCryptfs":12200,"Oracle T: Type (Oracle 12+)":12300,"BSDiCrypt, Extended DES":12400,"RAR3-hp":12500,"ColdFusion 10+":12600,"Blockchain, My Wallet":12700,"MS-AzureSync PBKDF2-HMAC-SHA256":12800,"Android FDE (Samsung DEK)":12900,"RAR5":13000,"Kerberos 5 TGS-REP etype 23":13100,"AxCrypt":13200,"AxCrypt in-memory SHA1":13300,"KeePass 1 AES / without keyfile":13400,"KeePass 2 AES / without keyfile":13400,"KeePass 1 Twofish / with keyfile":13400,"Keepass 2 AES / with keyfile":13400,"PeopleSoft PS_TOKEN":13500,"WinZip":13600,"VeraCrypt PBKDF2-HMAC-RIPEMD160 + AES":13711,"VeraCrypt PBKDF2-HMAC-RIPEMD160 + AES-Twofish":13712,"VeraCrypt PBKDF2-HMAC-RIPEMD160 + Serpent":13711,"VeraCrypt PBKDF2-HMAC-RIPEMD160 + Serpent-AES":13712,"VeraCrypt PBKDF2-HMAC-RIPEMD160 + Serpent-Twofish-AES":13713,"VeraCrypt PBKDF2-HMAC-RIPEMD160 + Twofish":13711,"VeraCrypt PBKDF2-HMAC-RIPEMD160 + Twofish-Serpent":13712,"VeraCrypt PBKDF2-HMAC-SHA256 + AES":13751,"VeraCrypt PBKDF2-HMAC-SHA256 + AES-Twofish":13752,"VeraCrypt PBKDF2-HMAC-SHA256 + Serpent":13751,"VeraCrypt PBKDF2-HMAC-SHA256 + Serpent-AES":13752,"VeraCrypt PBKDF2-HMAC-SHA256 + Serpent-Twofish-AES":13753,"VeraCrypt PBKDF2-HMAC-SHA256 + Twofish":13751,"VeraCrypt PBKDF2-HMAC-SHA256 + Twofish-Serpent":13752,"VeraCrypt PBKDF2-HMAC-SHA512 + AES":13721,"VeraCrypt PBKDF2-HMAC-SHA512 + AES-Twofish":13722,"VeraCrypt PBKDF2-HMAC-SHA512 + Serpent":13721,"VeraCrypt PBKDF2-HMAC-SHA512 + Serpent-AES":13722,"VeraCrypt PBKDF2-HMAC-SHA512 + Serpent-Twofish-AES":13723,"VeraCrypt PBKDF2-HMAC-SHA512 + Twofish":13721,"VeraCrypt PBKDF2-HMAC-SHA512 + Twofish-Serpent":13722,"VeraCrypt PBKDF2-HMAC-Whirlpool + AES":13731,"VeraCrypt PBKDF2-HMAC-Whirlpool + AES-Twofish":13732,"VeraCrypt PBKDF2-HMAC-Whirlpool + Serpent":13731,"VeraCrypt PBKDF2-HMAC-Whirlpool + Serpent-AES":13732,"VeraCrypt PBKDF2-HMAC-Whirlpool + Serpent-Twofish-AES":13733,"VeraCrypt PBKDF2-HMAC-Whirlpool + Twofish":13731,"VeraCrypt PBKDF2-HMAC-Whirlpool + Twofish-Serpent":13732,"Windows Phone 8+ PIN/password":13800,"OpenCart":13900,"DES (PT = $salt, key = $pass)":14000,"3DES (PT = $salt, key = $pass)":14100,"sha1(CX)":14400,"LUKS":14600,"iTunes backup < 10.0":14700,"iTunes backup >= 10.0":14800,"Skip32 (PT = $salt, key = $pass)":14900,"FileZilla Server >= 0.9.55":15000,"Juniper/NetBSD sha1crypt":15100,"Blockchain, My Wallet, V2":15200,"DPAPI master key file version 1 + local context":15300,"ChaCha20":15400,"JKS Java Key Store Private Keys (SHA1)":15500,"Ethereum Wallet, PBKDF2-HMAC-SHA256":15600,"Ethereum Wallet, SCRYPT":15700,"DPAPI master key file version 2 + Active Directory domain context":15900,"Tripcode":16000,"TACACS+":16100,"Apple Secure Notes":16200,"Ethereum Pre-Sale Wallet, PBKDF2-HMAC-SHA256":16300,"CRAM-MD5 Dovecot":16400,"JWT (JSON Web Token)":16500,"Electrum Wallet (Salt-Type 1-3)":16600,"FileVault 2":16700,"WPA-PMKID-PBKDF2":16800,"WPA-PMKID-PMK":16801,"Plaintext":99999},
			p2: {"900":{"type":"MD4","speed":7943750000},"0":{"type":"MD5","speed":4580406250},"5100":{"type":"Half MD5","speed":3077537500},"100":{"type":"SHA1","speed":1979043750},"10100":{"type":"SipHash","speed":8481249999.999999},"6100":{"type":"Whirlpool","speed":76737500},"6900":{"type":"GOST R 34.11-94","speed":63937500},"11700":{"type":"GOST R 34.11-2012 (Streebog) 256-bit","speed":18206250},"11800":{"type":"GOST R 34.11-2012 (Streebog) 512-bit","speed":19037500},"8900":{"type":"scrypt","speed":200500},"11900":{"type":"PBKDF2-HMAC-MD5","speed":1551337.5},"12000":{"type":"PBKDF2-HMAC-SHA1","speed":748393.75},"10900":{"type":"PBKDF2-HMAC-SHA256","speed":233587.5},"12100":{"type":"PBKDF2-HMAC-SHA512","speed":94781.25},"2500":{"type":"WPA\/WPA2","speed":82262.5},"5300":{"type":"IKE-PSK MD5","speed":318775000},"5400":{"type":"IKE-PSK SHA1","speed":166043750},"5600":{"type":"NetNTLMv2","speed":243525000},"7300":{"type":"IPMI2 RAKP HMAC-SHA1","speed":302593750},"7500":{"type":"Kerberos 5 AS-REQ Pre-Auth etype 23","speed":46700000},"13100":{"type":"Kerberos 5 TGS-REP etype 23","speed":46762500},"8300":{"type":"DNSSEC (NSEC3)","speed":764862500},"11400":{"type":"SIP digest authentication (MD5)","speed":514625000},"13900":{"type":"OpenCart","speed":448318750},"7900":{"type":"Drupal7","speed":12256.25},"11000":{"type":"PrestaShop","speed":1600681250},"10000":{"type":"Django (PBKDF2-SHA256)","speed":11250},"200":{"type":"MySQL323","speed":19100000000},"300":{"type":"MySQL4.1\/MySQL5","speed":886512500},"12300":{"type":"Oracle T: Type (Oracle 12+)","speed":22800},"8000":{"type":"Sybase ASE","speed":79312500},"12600":{"type":"ColdFusion 10+","speed":443556250},"3000":{"type":"LM","speed":3762593750},"1000":{"type":"NTLM","speed":8525000000},"1100":{"type":"Domain Cached Credentials (DCC), MS Cache","speed":2425962500},"2100":{"type":"Domain Cached Credentials 2 (DCC2), MS Cache 2","speed":70950},"12800":{"type":"MS-AzureSync PBKDF2-HMAC-SHA256","speed":2775737.5},"12400":{"type":"BSDiCrypt, Extended DES","speed":532431.25},"6300":{"type":"AIX {smd5}","speed":2506706.25},"6700":{"type":"AIX {ssha1}","speed":10662500},"6400":{"type":"AIX {ssha256}","speed":4049231.25},"6500":{"type":"AIX {ssha512}","speed":1368737.5},"2400":{"type":"Cisco-PIX MD5","speed":3236556250},"2410":{"type":"Cisco-ASA MD5","speed":3391518750},"501":{"type":"Juniper IVE","speed":2494525},"8100":{"type":"Citrix NetScaler","speed":1729706250},"8500":{"type":"RACF","speed":676900000},"7200":{"type":"GRUB 2","speed":9375},"9900":{"type":"Radmin2","speed":1694687500},"7700":{"type":"SAP CODVN B (BCODE)","speed":450800000},"7800":{"type":"SAP CODVN F\/G (PASSCODE)","speed":220693750},"10300":{"type":"SAP CODVN H (PWDSALTEDHASH) iSSHA-1","speed":1446281.25},"8600":{"type":"Lotus Notes\/Domino 5","speed":56050000},"8700":{"type":"Lotus Notes\/Domino 6","speed":13343750},"9100":{"type":"Lotus Notes\/Domino 8","speed":143625},"13500":{"type":"PeopleSoft PS_TOKEN","speed":723168750},"11600":{"type":"7-Zip","speed":2345},"13600":{"type":"WinZip","speed":239581.25},"12500":{"type":"RAR3-hp","speed":7437.5},"13000":{"type":"RAR5","speed":6818.75},"13200":{"type":"AxCrypt","speed":35975},"8800":{"type":"Android FDE <= 4.3","speed":169256.25},"12900":{"type":"Android FDE (Samsung DEK)","speed":54043.75},"12200":{"type":"eCryptfs","speed":2669.375},"10400":{"type":"PDF 1.1 - 1.3 (Acrobat 2 - 4)","speed":59068750},"10500":{"type":"PDF 1.4 - 1.6 (Acrobat 5 - 8)","speed":2869300},"10600":{"type":"PDF 1.7 Level 3 (Acrobat 9)","speed":765181250},"10700":{"type":"PDF 1.7 Level 8 (Acrobat 10 - 11)","speed":10543.75},"9000":{"type":"Password Safe v2","speed":64768.75},"5200":{"type":"Password Safe v3","speed":301181.25},"6600":{"type":"1Password, agilekeychain","speed":749400},"8200":{"type":"1Password, cloudkeychain","speed":2294},"11300":{"type":"Bitcoin\/Litecoin wallet.dat","speed":876.1875},"12700":{"type":"Blockchain, My Wallet","speed":18175000}},
			p3: {"900":{"type":"MD4","speed":81537500000},"0":{"type":"MD5","speed":56250000000},"5100":{"type":"Half MD5","speed":35187500000},"100":{"type":"SHA1","speed":16875000000},"1400":{"type":"SHA-256","speed":7496475000},"10800":{"type":"SHA-384","speed":2133175000.0000002},"1700":{"type":"SHA-512","speed":2160037500},"5000":{"type":"SHA-3 (Keccak)","speed":1698750000},"10100":{"type":"SipHash","speed":61262500000},"14900":{"type":"Skip32 (PT = $salt, key = $pass)","speed":3545062500},"6000":{"type":"RIPEMD-160","speed":9958612500},"6100":{"type":"Whirlpool","speed":699525000},"6900":{"type":"GOST R 34.11-94","speed":677437500},"11700":{"type":"GOST R 34.11-2012 (Streebog) 256-bit","speed":132212500},"11800":{"type":"GOST R 34.11-2012 (Streebog) 512-bit","speed":134087500},"14000":{"type":"DES (PT = $salt, key = $pass)","speed":46225000000},"14100":{"type":"3DES (PT = $salt, key = $pass)","speed":1925325000},"8900":{"type":"scrypt","speed":1162075},"11900":{"type":"PBKDF2-HMAC-MD5","speed":18037500},"12000":{"type":"PBKDF2-HMAC-SHA1","speed":6393562.5},"10900":{"type":"PBKDF2-HMAC-SHA256","speed":2651225},"12100":{"type":"PBKDF2-HMAC-SHA512","speed":844175},"2500":{"type":"WPA\/WPA2","speed":790625},"2501":{"type":"WPA\/WPA2 PMK","speed":401175000},"5300":{"type":"IKE-PSK MD5","speed":4075387500},"5400":{"type":"IKE-PSK SHA1","speed":1363612500},"5500":{"type":"NetNTLMv1 \/ NetNTLMv1+ESS","speed":44425000000},"5600":{"type":"NetNTLMv2","speed":3614025000},"7300":{"type":"IPMI2 RAKP HMAC-SHA1","speed":2942287500},"7500":{"type":"Kerberos 5 AS-REQ Pre-Auth etype 23","speed":1008037500},"13100":{"type":"Kerberos 5 TGS-REP etype 23","speed":1009125000},"8300":{"type":"DNSSEC (NSEC3)","speed":6181825000},"11100":{"type":"PostgreSQL CRAM (MD5)","speed":15250000000},"11200":{"type":"MySQL CRAM (SHA1)","speed":4232837499.9999995},"11400":{"type":"SIP digest authentication (MD5)","speed":7622950000},"8400":{"type":"WBB3 (Woltlab Burning Board)","speed":2257012500},"13900":{"type":"OpenCart","speed":3836050000},"7900":{"type":"Drupal7","speed":125887.5},"11000":{"type":"PrestaShop","speed":18950000000},"10000":{"type":"Django (PBKDF2-SHA256)","speed":134212.5},"200":{"type":"MySQL323","speed":166437500000},"300":{"type":"MySQL4.1\/MySQL5","speed":7377475000},"12300":{"type":"Oracle T: Type (Oracle 12+)","speed":234387.5},"8000":{"type":"Sybase ASE","speed":765937500},"1600":{"type":"Apache $apr1$ MD5, md5apr1, MD5 (APR)","speed":24800000},"12600":{"type":"ColdFusion 10+","speed":3968737500},"3000":{"type":"LM","speed":46912500000},"1000":{"type":"NTLM","speed":79212500000},"1100":{"type":"Domain Cached Credentials (DCC), MS Cache","speed":21362500000},"2100":{"type":"Domain Cached Credentials 2 (DCC2), MS Cache 2","speed":636987.5},"12800":{"type":"MS-AzureSync PBKDF2-HMAC-SHA256","speed":24462500},"1500":{"type":"descrypt, DES (Unix), Traditional DES","speed":1946450000},"500":{"type":"md5crypt, MD5 (Unix), Cisco-IOS $1$ (MD5)","speed":24725000},"3200":{"type":"bcrypt $2*$, Blowfish (Unix)","speed":54275},"7400":{"type":"sha256crypt $5$, SHA256 (Unix)","speed":1027849.9999999999},"1800":{"type":"sha512crypt $6$, SHA512 (Unix)","speed":372137.5},"6300":{"type":"AIX {smd5}","speed":24687500},"6700":{"type":"AIX {ssha1}","speed":87525000},"6400":{"type":"AIX {ssha256}","speed":40887500},"6500":{"type":"AIX {ssha512}","speed":12202750},"2400":{"type":"Cisco-PIX MD5","speed":39812500000},"2410":{"type":"Cisco-ASA MD5","speed":41150000000},"5700":{"type":"Cisco-IOS type 4 (SHA256)","speed":7511087500},"9200":{"type":"Cisco-IOS $8$ (PBKDF2-SHA256)","speed":134250},"9300":{"type":"Cisco-IOS $9$ (scrypt)","speed":55650},"501":{"type":"Juniper IVE","speed":24862500},"5800":{"type":"Samsung Android Password\/PIN","speed":11636950},"8100":{"type":"Citrix NetScaler","speed":14562500000},"8500":{"type":"RACF","speed":5820612500},"7200":{"type":"GRUB 2","speed":84850},"9900":{"type":"Radmin2","speed":19325000000},"7700":{"type":"SAP CODVN B (BCODE)","speed":4328100000},"7800":{"type":"SAP CODVN F\/G (PASSCODE)","speed":2621412500},"10300":{"type":"SAP CODVN H (PWDSALTEDHASH) iSSHA-1","speed":11496537.5},"8600":{"type":"Lotus Notes\/Domino 5","speed":719275000},"8700":{"type":"Lotus Notes\/Domino 6","speed":228887500},"9100":{"type":"Lotus Notes\/Domino 8","speed":1308387.5},"13500":{"type":"PeopleSoft PS_TOKEN","speed":5930750000},"11600":{"type":"7-Zip","speed":19612.5},"13600":{"type":"WinZip","speed":2093300.0000000002},"12500":{"type":"RAR3-hp","speed":77800},"13000":{"type":"RAR5","speed":81937.5},"13200":{"type":"AxCrypt","speed":354812.5},"13300":{"type":"AxCrypt in-memory SHA1","speed":15725000000},"8800":{"type":"Android FDE <= 4.3","speed":1606812.5},"12900":{"type":"Android FDE (Samsung DEK)","speed":654637.5},"12200":{"type":"eCryptfs","speed":31312.5},"9400":{"type":"MS Office 2007","speed":266650},"9500":{"type":"MS Office 2010","speed":133262.5},"9600":{"type":"MS Office 2013","speed":20437.5},"10400":{"type":"PDF 1.1 - 1.3 (Acrobat 2 - 4)","speed":1284012500},"10500":{"type":"PDF 1.4 - 1.6 (Acrobat 5 - 8)","speed":57037500},"10600":{"type":"PDF 1.7 Level 3 (Acrobat 9)","speed":7526737500},"10700":{"type":"PDF 1.7 Level 8 (Acrobat 10 - 11)","speed":55775},"9000":{"type":"Password Safe v2","speed":1174037.5},"5200":{"type":"Password Safe v3","speed":2969362.5},"6800":{"type":"LastPass + LastPass sniffed","speed":5503200},"6600":{"type":"1Password, agilekeychain","speed":6429300},"8200":{"type":"1Password, cloudkeychain","speed":24037.5},"11300":{"type":"Bitcoin\/Litecoin wallet.dat","speed":10251.75},"12700":{"type":"Blockchain, My Wallet","speed":132324999.99999999},"15200":{"type":"Blockchain, My Wallet, V2","speed":647862.5},"15500":{"type":"JKS Java Key Store Private Keys (SHA1)","speed":16287500000.000002},"15600":{"type":"Ethereum Wallet, PBKDF2-HMAC-SHA256","speed":10242.5},"15400":{"type":"ChaCha20","speed":8172900000}},
			g3: {"900":{"type":"MD4","speed":18303100000},"0":{"type":"MD5","speed":10619200000},"5100":{"type":"Half MD5","speed":6997300000},"100":{"type":"SHA1","speed":3915400000},"1400":{"type":"SHA-256","speed":1439250000},"10800":{"type":"SHA-384","speed":425900000},"1700":{"type":"SHA-512","speed":435400000},"5000":{"type":"SHA-3 (Keccak)","speed":386700000},"10100":{"type":"SipHash","speed":13306250000},"14900":{"type":"Skip32 (PT = $salt, key = $pass)","speed":1293700000},"6000":{"type":"RIPEMD-160","speed":2243950000},"6100":{"type":"Whirlpool","speed":84200000},"6900":{"type":"GOST R 34.11-94","speed":116200000},"11700":{"type":"GOST R 34.11-2012 (Streebog) 256-bit","speed":22935500},"11800":{"type":"GOST R 34.11-2012 (Streebog) 512-bit","speed":23018450},"14000":{"type":"DES (PT = $salt, key = $pass)","speed":9382900000},"14100":{"type":"3DES (PT = $salt, key = $pass)","speed":242100000},"8900":{"type":"scrypt","speed":302100},"11900":{"type":"PBKDF2-HMAC-MD5","speed":3446350},"12000":{"type":"PBKDF2-HMAC-SHA1","speed":1500750},"10900":{"type":"PBKDF2-HMAC-SHA256","speed":535950},"12100":{"type":"PBKDF2-HMAC-SHA512","speed":175750},"2500":{"type":"WPA\/WPA2","speed":189150},"2501":{"type":"WPA\/WPA2 PMK","speed":73500000},"5300":{"type":"IKE-PSK MD5","speed":798450000},"5400":{"type":"IKE-PSK SHA1","speed":323950000},"5500":{"type":"NetNTLMv1 \/ NetNTLMv1+ESS","speed":10356650000},"5600":{"type":"NetNTLMv2","speed":767650000},"7300":{"type":"IPMI2 RAKP HMAC-SHA1","speed":728200000},"7500":{"type":"Kerberos 5 AS-REQ Pre-Auth etype 23","speed":136900000},"13100":{"type":"Kerberos 5 TGS-REP etype 23","speed":142650000},"8300":{"type":"DNSSEC (NSEC3)","speed":1526750000},"11100":{"type":"PostgreSQL CRAM (MD5)","speed":3206400000},"11200":{"type":"MySQL CRAM (SHA1)","speed":1071000000},"11400":{"type":"SIP digest authentication (MD5)","speed":1515700000},"8400":{"type":"WBB3 (Woltlab Burning Board)","speed":565300000},"13900":{"type":"OpenCart","speed":949000000},"7900":{"type":"Drupal7","speed":24796},"11000":{"type":"PrestaShop","speed":4036650000},"10000":{"type":"Django (PBKDF2-SHA256)","speed":27217.5},"200":{"type":"MySQL323","speed":22472750000},"300":{"type":"MySQL4.1\/MySQL5","speed":1724450000},"12300":{"type":"Oracle T: Type (Oracle 12+)","speed":42151},"8000":{"type":"Sybase ASE","speed":159900000},"1600":{"type":"Apache $apr1$ MD5, md5apr1, MD5 (APR)","speed":4768300},"12600":{"type":"ColdFusion 10+","speed":827350000},"3000":{"type":"LM","speed":9231400000},"1000":{"type":"NTLM","speed":18249450000},"1100":{"type":"Domain Cached Credentials (DCC), MS Cache","speed":5278850000},"2100":{"type":"Domain Cached Credentials 2 (DCC2), MS Cache 2","speed":153650},"12800":{"type":"MS-AzureSync PBKDF2-HMAC-SHA256","speed":4288700},"1500":{"type":"descrypt, DES (Unix), Traditional DES","speed":456450000},"500":{"type":"md5crypt, MD5 (Unix), Cisco-IOS $1$ (MD5)","speed":4769900},"3200":{"type":"bcrypt $2*$, Blowfish (Unix)","speed":7055},"7400":{"type":"sha256crypt $5$, SHA256 (Unix)","speed":186600},"1800":{"type":"sha512crypt $6$, SHA512 (Unix)","speed":74750},"6300":{"type":"AIX {smd5}","speed":4765650},"6700":{"type":"AIX {ssha1}","speed":17496150},"6400":{"type":"AIX {ssha256}","speed":7508250},"6500":{"type":"AIX {ssha512}","speed":2386400},"2400":{"type":"Cisco-PIX MD5","speed":7781100000},"2410":{"type":"Cisco-ASA MD5","speed":8009400000},"5700":{"type":"Cisco-IOS type 4 (SHA256)","speed":1432900000},"9200":{"type":"Cisco-IOS $8$ (PBKDF2-SHA256)","speed":27219.5},"9300":{"type":"Cisco-IOS $9$ (scrypt)","speed":9405},"501":{"type":"Juniper IVE","speed":4764200},"5800":{"type":"Samsung Android Password\/PIN","speed":2597050},"8100":{"type":"Citrix NetScaler","speed":3477200000},"8500":{"type":"RACF","speed":1246700000},"7200":{"type":"GRUB 2","speed":17696},"9900":{"type":"Radmin2","speed":3880850000},"7700":{"type":"SAP CODVN B (BCODE)","speed":714800000},"7800":{"type":"SAP CODVN F\/G (PASSCODE)","speed":479100000},"10300":{"type":"SAP CODVN H (PWDSALTEDHASH) iSSHA-1","speed":2618200},"8600":{"type":"Lotus Notes\/Domino 5","speed":107300000},"8700":{"type":"Lotus Notes\/Domino 6","speed":35410550},"9100":{"type":"Lotus Notes\/Domino 8","speed":309450},"13500":{"type":"PeopleSoft PS_TOKEN","speed":1449800000},"11600":{"type":"7-Zip","speed":3880.5},"13600":{"type":"WinZip","speed":489050},"12500":{"type":"RAR3-hp","speed":14405.5},"13000":{"type":"RAR5","speed":16611.5},"13200":{"type":"AxCrypt","speed":56900},"13300":{"type":"AxCrypt in-memory SHA1","speed":3644500000},"8800":{"type":"Android FDE <= 4.3","speed":382600},"12900":{"type":"Android FDE (Samsung DEK)","speed":132500},"12200":{"type":"eCryptfs","speed":6387.5},"9400":{"type":"MS Office 2007","speed":64750},"9500":{"type":"MS Office 2010","speed":32434},"9600":{"type":"MS Office 2013","speed":4122},"10400":{"type":"PDF 1.1 - 1.3 (Acrobat 2 - 4)","speed":166600000},"10500":{"type":"PDF 1.4 - 1.6 (Acrobat 5 - 8)","speed":7853700},"10600":{"type":"PDF 1.7 Level 3 (Acrobat 9)","speed":1432400000},"10700":{"type":"PDF 1.7 Level 8 (Acrobat 10 - 11)","speed":13801},"9000":{"type":"Password Safe v2","speed":156600},"5200":{"type":"Password Safe v3","speed":559950},"6800":{"type":"LastPass + LastPass sniffed","speed":1013650},"6600":{"type":"1Password, agilekeychain","speed":1482800},"8200":{"type":"1Password, cloudkeychain","speed":4322},"11300":{"type":"Bitcoin\/Litecoin wallet.dat","speed":2073.5},"12700":{"type":"Blockchain, My Wallet","speed":20953100},"15200":{"type":"Blockchain, My Wallet, V2","speed":154750},"15500":{"type":"JKS Java Key Store Private Keys (SHA1)","speed":3708550000},"15600":{"type":"Ethereum Wallet, PBKDF2-HMAC-SHA256","speed":2078},"15400":{"type":"ChaCha20","speed":1860600000}},

			pricing: new AWS.Pricing({
				apiVersion: '2017-10-15',
				region: 'us-east-1'
			}),

			ec2e1: new AWS.EC2({
				apiVersion: '2016-11-15',
				region: 'us-east-1'
			}),

			ec2e2: new AWS.EC2({
				apiVersion: '2016-11-15',
				region: 'us-east-2'
			}),

			ec2w1: new AWS.EC2({
				apiVersion: '2016-11-15',
				region: 'us-west-1'
			}),

			ec2w2: new AWS.EC2({
				apiVersion: '2016-11-15',
				region: 'us-west-2'
			}),

			spotPrice: {},
			spotPriceHistory: {
				"us-west-1": {},
				"us-west-2": {},
				"us-east-1": {},
				"us-east-2": {}
			},
			getSpotPriceHistory: function (instanceType, forceRegion) {
				var self = this;

				/*
				if (typeof self.spotPrice[instanceType] != "undefined") {
					return self.spotPrice[instanceType];
				}
				*/

				var regions = [];
				switch (forceRegion) {
					case "us-west-1":
						regions.push(self.ec2w1);
					break;

					case "us-west-2":
						regions.push(self.ec2w2);
					break;

					case "us-east-1":
						regions.push(self.ec2e1);
					break;

					case "us-east-2":
						// regions.push(self.ec2e2);
						alert('us-east-2 is currently not supported by NVidia');
					break;

					default:
						regions = [
							self.ec2w1,
							self.ec2w2,
							self.ec2e1,
							//self.ec2e2
						];
					break;
				}
				
				var promises = [];

				regions.forEach(function (e) {
					promises.push(new Promise(function(resolve, reject) {
						if (typeof self.spotPriceHistory[e.config.region][instanceType] != "undefined") {
							resolve(self.spotPriceHistory[e.config.region][instanceType]);
						}
						e.describeSpotPriceHistory({
							StartTime: Math.round(Date.now() / 1000),
							EndTime: Math.round(Date.now() / 1000),
							InstanceTypes: [
								instanceType
							],
							ProductDescriptions: [
								"Linux/UNIX (Amazon VPC)"
							]
						}, function (err, data) {
							if (err) {
								reject(err);
							}

							self.spotPriceHistory[e.config.region][instanceType] = data;
							resolve(data);
						});
					}));
				});

				return Promise.all(promises).then((data) => {
					var results = {
						cheapestRegion: '',
						price: null
					};

					Object.keys(data).forEach(function(e) {
						Object.keys(data[e].SpotPriceHistory).forEach(function(i) {
							var item = data[e].SpotPriceHistory[i];

							if (parseFloat(item.SpotPrice) < results.price || results.price == null) {
								results = {
									cheapestRegion: item.AvailabilityZone,
									price: parseFloat(item.SpotPrice),
									instanceType: instanceType
								};
							}
						});
					});

					self.spotPrice[instanceType] = results;
					return results;

				}).catch((err) => {
					// console.trace(err);
					return new Error(err);
				});
			},

			getServices: function () {
				var self = this;

				return new Promise(function(resolve, reject) {
					
					self.pricing.describeServices({
							FormatVersion: "aws_v1", 
							MaxResults: 1, 
							ServiceCode: "AmazonEC2"
						}, function (err, data) {
							if (err) {
								console.trace(new Error(err));
								reject(err);
							}

							console.log(data);
							resolve(data);
						});
				});
			},

			getAttributes: function (attr) {
				var self = this;

				return new Promise(function(resolve, reject) {
					self.pricing.getAttributeValues({
							AttributeName: attr, // "gpu"
							MaxResults: 100, 
							ServiceCode: "AmazonEC2"
						}, function (err, data) {
							if (err) {
								console.trace(new Error(err));
								reject(err);
							}

							console.log(data);
							resolve(data);
						});
				});
			},

			getPricing: function () {
				var self = this;

				return new Promise(function(resolve, reject) {
					self.pricing.getProducts({
						Filters: [{
							Field: "instanceFamily", 
							Type: "TERM_MATCH", 
							Value: "GPU instance"
						}, {
							Field: "operatingSystem",
							Type: "TERM_MATCH",
							Value: "Linux"

						}], 
						FormatVersion: "aws_v1", 
						MaxResults: 100,
						ServiceCode: "AmazonEC2"
					}, function (err, data) {
						if (err) {
							console.trace(new Error(err));
							reject(err);
						}

						console.log(data);
						resolve(data);
					});
				});
			},
		};
	}]);