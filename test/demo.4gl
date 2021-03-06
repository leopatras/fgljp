MAIN
  DEFINE arg STRING
  DEFINE num INT
  LET arg = arg_val(1)
  IF arg IS NOT NULL THEN
    DISPLAY "arg1:", arg, ",arg2:", arg_val(2)
    --MESSAGE "arg1:", arg, ",arg2:", arg_val(2)
    IF arg == "fc" THEN
      CALL fc()
    END IF
  END IF
  MENU arg
    COMMAND "Long Sleep"
      SLEEP 5
      MESSAGE "Sleep done"
    COMMAND "Processing"
      CALL testProcessing()
    ON ACTION message ATTRIBUTE(IMAGE = "smiley", TEXT = "Message")
      LET num=num+1
      MESSAGE sfmt("TEST%1",num)
      --ON IDLE 10
      --  MESSAGE "IDLE"
    COMMAND "fc"
      CALL fc()
    COMMAND "Show Form"
      CALL showForm("logo.png")
    COMMAND "RUN"
      RUN SFMT("fglrun demo %1 %2", arg || "+", arg_val(2))
    COMMAND "RUN xx"
      RUN "fglrun xx"
    COMMAND "RUN WITHOUT WAITING"
      RUN SFMT("fglrun demo %1 %2", arg || "+", arg_val(2)) WITHOUT WAITING
    COMMAND "putfile"
      {
      OPEN WINDOW w AT 1,1 WITH 10 ROWS, 10 COLUMNS 
      MENU 
         COMMAND "exit"
           EXIT MENU
      END MENU
      }
      CALL fgl_putfile("logo.png","logo2.png")
      DISPLAY "putfile done"
      --CLOSE WINDOW w
      MESSAGE "putfile successful"
    COMMAND "getfile"
      TRY
      CALL fgl_getfile("logo2.png","logo3.png")
      CATCH
        ERROR err_get(status)
        CONTINUE MENU
      END TRY
      CALL showForm("logo3.png")
      MESSAGE "getfile successful"
    COMMAND "env"
      RUN "env | grep FGL"

    COMMAND "x EXIT"
      EXIT MENU
  END MENU
END MAIN

FUNCTION testProcessing()
  DEFINE i INT
  OPEN WINDOW processing AT 1,1 WITH 10 ROWS,10 COLUMNS
  FOR i=1 TO 3
    MESSAGE sfmt("Processing %1",i)
    CALL ui.Interface.refresh()
  END FOR
  CLOSE WINDOW processing
END FUNCTION

FUNCTION showForm(img STRING)
  OPEN FORM f FROM "demo"
  DISPLAY FORM f
  DISPLAY "Entry" TO entry
  DISPLAY "ui.InInterface.filenameToURI:",ui.Interface.filenameToURI(img)
  DISPLAY sfmt('{"value": "WebComponent", "src":"%1"}',ui.Interface.filenameToURI(img)) TO w
  DISPLAY img TO logo
END FUNCTION

FUNCTION fc()
  DEFINE starttime DATETIME HOUR TO FRACTION(3)
  DEFINE diff INTERVAL MINUTE TO FRACTION(3)
  DEFINE i INT
  --CONSTANT MAXCNT = 1000
  CONSTANT MAXCNT = 10
  LET starttime = CURRENT
  FOR i = 1 TO MAXCNT
    CALL ui.Interface.frontCall("standard", "feinfo", ["fename"], [])
  END FOR
  LET diff = CURRENT - starttime
  --CALL fgl_winMessage("Info",SFMT("time:%1,time for one frontcall:%2",diff,diff/MAXCNT),"info")
  DISPLAY SFMT("time:%1,time for one frontcall:%2", diff, diff / MAXCNT)
  MESSAGE SFMT("time:%1,time for one frontcall:%2", diff, diff / MAXCNT)
END FUNCTION
