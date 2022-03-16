<?php

if (count($argv) < 2) {
	echo "\nSyntax: " . $argv[0] . " <benchmarkfile.txt>\n\n";
	exit();
}

//$benchmark = explode("Hashmode: ", file_get_contents($argv[1]));
$benchmark = explode("Hash-Mode ", file_get_contents($argv[1]));
$speeds = array();

array_shift($benchmark);
while (count($benchmark) > 0) {
	$entry = array_shift($benchmark);
	// $entry = explode(" - ", $entry);
	$entry = explode(" ", $entry);

	//array_shift($entry);
	$id = array_shift($entry);
	echo "id: " . $id . "\n";
	$entry = explode("\n", implode(" ", $entry));

	$name = substr(array_shift($entry), 1, -1);
	echo "name: " . $name . "\n";
	array_shift($entry);

	$speed = array();
	foreach($entry as $line) {
		echo $line;
		preg_match("/\:\s*?([\d\.]+)\s(.{0,1}H\/s)\s/", $line, $matches);

		print_r($matches);

		if (count($matches) > 0) {
			$hashes = $matches[1];
			switch($matches[2]) {
				case "H/s":
				break;

				case "kH/s":
					$hashes *= 1000;
				break;

				case "MH/s":
					$hashes *= 1000000;
				break;

				case "GH/s":
					$hashes *= 1000000000;
				break;

				default:
					echo "Unknown unit: " . $matches[0][2];
				break;
			}

			array_push($speed, $hashes);
		}
	}

	$speed = array_sum($speed) / count($speed);

	$speeds[$id] = $speed;
}

echo json_encode($speeds);


?>