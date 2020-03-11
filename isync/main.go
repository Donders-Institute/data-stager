package main

import (
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"

	log "github.com/sirupsen/logrus"

	pb "github.com/schollz/progressbar/v2"
)

var optsVerbose *bool
var optsProgressBar *bool

func init() {
	optsVerbose = flag.Bool("d", false, "print debug messages")
	optsProgressBar = flag.Bool("b", false, "show progress bar")

	flag.Usage = usage
	flag.Parse()

	log.SetOutput(os.Stderr)
	llevel := log.InfoLevel
	if *optsVerbose {
		llevel = log.DebugLevel
	}

	log.SetLevel(llevel)
}

func usage() {
	fmt.Printf("\nSynchronizing data between local filesystem and iRODS\n")
	fmt.Printf("\nUSAGE: %s [OPTIONS] {path_source} {path_destination}\n", os.Args[0])
	fmt.Printf("\nOPTIONS:\n")
	flag.PrintDefaults()
	fmt.Printf("\n")
	fmt.Printf("For iRODS path, use the prefix \"i:\" at the front.\n")
	fmt.Printf("\n")
}

func main() {

	if flag.NArg() != 2 {
		flag.Usage()
		log.Fatal("insufficient arguments.")
	}

	// source path: /project/3010000.01
	src := flag.Args()[0]

	// destination path: i:/nl.ru.donders/di/dccn/DAC_3010000.01_173
	dst := flag.Args()[1]

	srcPathInfo, err := GetPathInfo(src)
	if err != nil {
		log.Fatal(err)
	}

	log.Debugf("src path info: %+v\n", srcPathInfo)

	dstPathInfo, _ := GetPathInfo(dst)

	log.Debugf("dst path info: %+v\n", dstPathInfo)

	// get number of files at source
	nf, err := GetNumberOfFiles(srcPathInfo)
	if err != nil {
		log.Fatal(err)
	}

	if nf == 0 {
		log.Warnf("nothing to sync: %s\n", src)
		os.Exit(0)
	}

	// progress bar
	bar := pb.NewOptions(nf,
		pb.OptionSetPredictTime(false),
		pb.OptionSetTheme(pb.Theme{
			Saucer:        "#",
			SaucerPadding: "-",
			BarStart:      "[",
			BarEnd:        "]",
		}),
	)
	if *optsProgressBar {
		bar.RenderBlank()
	}

	success, failure := ScanAndSync(srcPathInfo, dstPathInfo, 4)

	c := 0
	ec := 0
	for {
		select {
		case _, ok := <-success:
			if !ok {
				success = nil
			} else {
				// increase the counter by 1, and write progress to stdout
				c++
				if *optsProgressBar {
					bar.Add(1)
				} else {
					fmt.Printf("progress:%d:%d:%d\n", c*100./nf, c, nf)
				}
			}
		case e, ok := <-failure:
			if !ok {
				failure = nil
			} else {
				ec = 2
				// write error to the stderr
				log.Errorf("failure: %s\n", e.Error)
			}
		default:
			// this dummy progress string is printed to circumvent stager job killing due to timeout_noprocess (3600 sec.) is reached.
			if !*optsProgressBar && c == 0 {
				// sleep for a second.
				time.Sleep(time.Second)
				// keep printing progress value while there is still nothing reported back from the irsync scan.
				fmt.Printf("progress:%d:%d:%d\n", c*100./nf, c, nf)
			}
		}

		if success == nil && failure == nil {
			log.Debugln("finish")
			break
		}
	}

	// return exit code ec
	if *optsProgressBar {
		fmt.Println()
	}
	os.Exit(ec)
}

// PathType represents the namespace type a path is referring to.
type PathType int

const (
	// TypeFileSystem is the namespace type for local filesystem.
	TypeFileSystem PathType = iota
	// TypeIrods is the the namespace type for iRODS.
	TypeIrods
)

// PathInfo defines a data structure of the path information.
type PathInfo struct {
	// Path is the path in question.
	Path string
	// PathType is the namespace type of the path.
	Type PathType
	// Mode is the `os.FileMode` of the path.
	Mode os.FileMode
}

// GetPathInfo resolves the PathInfo of the given path.
func GetPathInfo(path string) (PathInfo, error) {

	var info PathInfo

	if strings.HasPrefix(path, "i:") {

		ipath := strings.TrimSuffix(strings.TrimPrefix(path, "i:"), "/")

		info.Path = ipath
		info.Type = TypeIrods

		// check if the namespace refers to a file object.
		if _, err := exec.Command("imeta", "ls", "-d", ipath).Output(); err == nil {
			info.Mode = 0
			return info, nil
		}

		// check if the namespace refers to a collection object.
		if _, err := exec.Command("imeta", "ls", "-C", ipath).Output(); err == nil {
			info.Mode = os.ModeDir
			return info, nil
		}

	} else {

		info.Path = path
		info.Type = TypeFileSystem

		if fi, err := os.Stat(path); err == nil {
			info.Mode = fi.Mode()
			return info, nil
		}
	}

	return info, fmt.Errorf("file or directory not found: %s", path)
}

// GetNumberOfFiles get total number of files at or within the `path`.
func GetNumberOfFiles(path PathInfo) (int, error) {

	nf := 0

	var cmds []string

	if path.Mode.IsRegular() {
		return 1, nil
	}

	// The path is a collection, use iquery to get number of files.
	if path.Mode.IsDir() && path.Type == TypeIrods {
		cmds = append(cmds,
			fmt.Sprintf("iquest --no-page '%%s' \"SELECT DATA_NAME WHERE COLL_NAME = '%s'\" | wc -l", path.Path),
			fmt.Sprintf("iquest --no-page '%%s/%%s' \"SELECT COLL_NAME,DATA_NAME WHERE COLL_NAME like '%s/%%'\" | wc -l", path.Path),
		)
	}

	// The path is a filesystem directory, use command `find -type f` to get number of files.
	if path.Mode.IsDir() && path.Type == TypeFileSystem {
		cmds = append(cmds, fmt.Sprintf("find %s -type f | wc -l", path.Path))
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

// // DirMaker makes new directory.
// type DirMaker struct {
// 	mux sync.Mutex
// }

// // MakeDir creates directory at the given path either on iCAT (with path prefix "i:") or local filesystem, in a
// // synchronous manner.
// func (d *DirMaker) MakeDir(path string, t PathType) error {

// 	defer d.mux.Unlock()

// 	switch t {
// 	case TypeIrods:
// 		d.mux.Lock()
// 		_, err := exec.Command("imkdir", "-p", strings.TrimPrefix(path, "i:")).Output()
// 		if err != nil {
// 			return fmt.Errorf("cannot create %s: %s", path, err)
// 		}
// 	case TypeFileSystem:
// 		d.mux.Lock()
// 		_, err := exec.Command("mkdir", "-p", path).Output()
// 		if err != nil {
// 			return fmt.Errorf("cannot create %s: %s", path, err)
// 		}
// 	}

// 	return nil
// }

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
func ScanAndSync(src, dst PathInfo, nworkers int) (success chan string, failure chan SyncError) {

	success = make(chan string)
	failure = make(chan SyncError)

	// initiate a source scanner and performs the scan.
	scanner := NewScanner(src)
	dirmaker := NewDirMaker(dst)

	files := scanner.ScanMakeDir(src.Path, nworkers*8, dirmaker)

	// create worker group
	var wg sync.WaitGroup
	wg.Add(nworkers)

	// spin off workers
	for i := 1; i <= nworkers; i++ {
		go syncWorker(i, &wg, src, dst, files, success, failure)
	}

	go func() {
		// wait for all workers to finish.
		wg.Wait()
		// close success and failure channels.
		close(success)
		close(failure)
	}()

	return
}

func syncWorker(id int, wg *sync.WaitGroup, src, dst PathInfo, files chan string, success chan string, failure chan SyncError) {

	fsrcPrefix := ""
	fdstPrefix := ""

	if src.Type == TypeIrods {
		fsrcPrefix = "i:"
	}

	if dst.Type == TypeIrods {
		fdstPrefix = "i:"
	}

	for fsrc := range files {
		// determin destination file path.
		fdst := path.Join(dst.Path, strings.TrimPrefix(fsrc, src.Path))

		// run irsync
		cmdExec := "irsync"
		cmdArgs := []string{"-K", "-v", fmt.Sprintf("%s%s", fsrcPrefix, fsrc), fmt.Sprintf("%s%s", fdstPrefix, fdst)}

		log.Debugf("exec: %s %s", cmdExec, strings.Join(cmdArgs, " "))

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
