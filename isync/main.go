package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
)

func main() {
	// example: /project/3010000.01
	src := os.Args[1]

	// example: i:/nl.ru.donders/di/dccn/DAC_3010000.01_173
	dst := os.Args[2]

	// get number of files at source
	nf, err := GetNumberOfFiles(src)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("total number: %d\n", nf)

	success, failure := ScanAndSync(src, dst, 4)

	c := 0
	for {
		select {
		case _, ok := <-success:
			if !ok {
				success = nil
			} else {
				// increase the counter by 1, and write progress to stdout
				c++
				fmt.Printf("progress: %d:%d:%d\n", c*100./nf, c, nf)
			}
		case e, ok := <-failure:
			if !ok {
				failure = nil
			} else {
				// write error to the stderr
				fmt.Fprintf(os.Stderr, "failure: %s\n", e.Error)
			}
		}

		if success == nil && failure == nil {
			fmt.Fprintf(os.Stderr, "finish\n")
			break
		}
	}

}

// GetNumberOfFiles get total number of files at or within the `path`.
func GetNumberOfFiles(path string) (int, error) {

	nf := 0

	var cmds []string

	if strings.HasPrefix(path, "i:") {

		// trim leading "i:" and tailing "/" from iRODS namespace
		ipath := strings.TrimSuffix(strings.TrimPrefix(path, "i:"), "/")

		// check if path is a file object.
		if _, err := exec.Command("imeta", "ls", "-d", ipath).Output(); err == nil {
			return 1, nil
		}

		// The path is (probably) a collection, use iquery to get number of files.
		cmds = append(cmds,
			fmt.Sprintf("iquest --no-page '%%s' \"SELECT DATA_NAME WHERE COLL_NAME = '%s'\" | wc -l", ipath),
			fmt.Sprintf("iquest --no-page '%%s/%%s' \"SELECT COLL_NAME,DATA_NAME WHERE COLL_NAME like '%s/%%'\" | wc -l", ipath),
		)
	} else {

		// check if path is a regular file.
		fi, err := os.Stat(path)
		if err != nil {
			return nf, err
		}

		if fi.Mode().IsRegular() {
			return 1, nil
		}

		// The path is (probably) a directory, use command `find -type f` to get number of files.
		cmds = append(cmds, fmt.Sprintf("find %s -type f | wc -l", path))
	}

	// run commands to get total number of files within the path.
	for _, cmd := range cmds {

		// run the command through bash
		out, err := exec.Command("bash", "-c", cmd).Output()
		if err != nil {
			return nf, fmt.Errorf("cannot count files: %s", err)
		}

		// remove the line ending "\n" from out
		n, err := strconv.Atoi(strings.TrimSuffix(string(out), "\n"))
		if err != nil {
			return nf, fmt.Errorf("cannot count files: %s", err)
		}

		nf += n
	}

	return nf, nil
}

// MakeDir creates directory at the given path either on iCAT (with path prefix "i:") or local filesystem.
func MakeDir(path string) error {

	if strings.HasPrefix(path, "i:") {
		_, err := exec.Command("imkdir", "-p", strings.TrimPrefix(path, "i:")).Output()
		if err != nil {
			return fmt.Errorf("cannot create %s: %s", path, err)
		}
	} else {
		_, err := exec.Command("mkdir", "-p", path).Output()
		if err != nil {
			return fmt.Errorf("cannot create %s: %s", path, err)
		}
	}

	return nil
}

// SyncError registers the error message of a particular file sync error.
type SyncError struct {
	File  string
	Error error
}

// ScanAndSync walks through the files retrieved from the `bufio.Scanner`,
// sync each file from the `srcColl` collection to the `dstColl` collection.
//
// The sync operation is performed in a concurrent way.  The degree of concurrency is
// defined by number of sync workers, `nworkers`.
//
// Files being successfully synced will be returned as a map with key as the filename
// and value as the checksum of the file.
func ScanAndSync(src, dst string, nworkers int) (success chan string, failure chan SyncError) {

	files := make(chan string, nworkers*8)

	success = make(chan string)
	failure = make(chan SyncError)

	// create worker group
	var wg sync.WaitGroup
	wg.Add(nworkers)

	// spin off workers
	for i := 1; i <= nworkers; i++ {
		go syncWorker(i, &wg, src, dst, files, success, failure)
	}

	// scan to get payload into the files channel
	go func() {

		// run irsync to list files not yet in sync.
		cmd := exec.Command("irsync", "-v", "-l", "-r", src, dst)

		stdout, err := cmd.StdoutPipe()
		if err != nil {
			log.Fatal(err)
		}

		stderr, err := cmd.StderrPipe()
		if err != nil {
			log.Fatal(err)
		}

		defer func() {
			stdout.Close()
			stderr.Close()

			close(success)
			close(failure)
		}()

		if err := cmd.Start(); err != nil {
			log.Fatal(err)
		}

		scanner := bufio.NewScanner(stdout)
		scanner.Split(bufio.ScanLines)

		// Regular expression of parsing file path at source.
		// The out can be one of the follows:
		//
		// /project/3010000.01/fio-test/131.174.44.211.randr.4.0   2147483648   N
		// 131.174.44.211.randr.4.0     2047.953 MB | 0.000 sec | 0 thr | 93088776.000 MB/s
		//
		// We need to parse the file path at source from the first example, e.g. /project/3010000.01/fio-test/131.174.44.211.randr.4.0.
		r := regexp.MustCompile(`(^.*)\s+[0-9]+\s+\S+$`)

		// trim the prefix "i:" for matching the file path of irsyc.
		isrc := strings.TrimPrefix(src, "i:")

		for scanner.Scan() {

			out := scanner.Text()

			// skip files already in sync
			if strings.Contains(out, `a match no sync required`) {
				success <- out
				continue
			}

			// ignore the line starts with "C-"
			if strings.HasPrefix(out, "C-") {
				continue
			}

			// ignore the line not starting with src
			if !strings.HasPrefix(out, isrc) {
				continue
			}

			// ignore the line if not matching the defined regular expression.
			if !r.MatchString(out) {
				continue
			}

			files <- strings.TrimSpace(r.FindStringSubmatch(out)[1])
		}
		close(files)

		if err := scanner.Err(); err != nil {
			// something wrong with the scan
			fmt.Printf("error scanning manifest file: %s\n", err)
		}

		// wait for workers to finish, and close the channels.
		wg.Wait()
	}()

	return success, failure
}

func syncWorker(id int, wg *sync.WaitGroup, src, dst string, files chan string, success chan string, failure chan SyncError) {

	isDstIrods := strings.HasPrefix(dst, "i:")

	for fsrc := range files {
		// determin destination file path.
		fdst := path.Join(dst, strings.TrimPrefix(fsrc, strings.TrimPrefix(src, "i:")))

		// make the parent directory available at the destination.
		if err := MakeDir(filepath.Dir(fdst)); err != nil {
			failure <- SyncError{
				File:  fsrc,
				Error: err,
			}
			continue
		}

		// run iput or iget depending on destination location.
		cmdExec := "iget"
		cmdArgs := []string{"-K", "-f", fsrc, strings.TrimPrefix(fdst, "i:")}
		if isDstIrods {
			cmdExec = "iput"
		}

		if _, err := exec.Command(cmdExec, cmdArgs...).Output(); err != nil {
			failure <- SyncError{
				File:  fsrc,
				Error: fmt.Errorf("%s %s fail: %s", cmdExec, strings.Join(cmdArgs, " "), err),
			}
		} else {
			success <- fsrc
		}
	}
	wg.Done()
}
